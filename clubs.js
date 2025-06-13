import DOMPurify from 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.7/purify.min.js';
import { io } from 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js';

// Global state management
/**
 * @typedef {Object} AppState
 * @property {string} currentUserId - Unique ID of the current user
 * @property {string} currentUsername - Username of the current user
 * @property {string|null} currentClubId - Currently selected club ID
 * @property {Array<Object>} clubData - Array of club objects
 * @property {Object.<string, Array<Object>>} messageData - Messages per club
 * @property {number} currentCreateClubPage - Current page in create club modal
 * @property {Array<string>} selectedTopics - Selected topics for club creation
 * @property {Object|null} socket - Socket.IO instance
 * @property {boolean} isSocketInitialized - Socket initialization status
 * @property {Object.<string, number>} rateLimits - Rate limit counters
 * @property {Object.<string, number>} analytics - Engagement analytics
 */
const state = {
    currentUserId: localStorage.getItem('currentUserId') || `user_${Date.now()}`,
    currentUsername: localStorage.getItem('currentUsername') || 'Guest',
    currentClubId: localStorage.getItem('currentClubId') || null,
    clubData: JSON.parse(localStorage.getItem(`clubs_${localStorage.getItem('currentUserId')}`)) || [],
    messageData: {},
    currentCreateClubPage: 1,
    selectedTopics: [],
    socket: null,
    isSocketInitialized: false,
    rateLimits: {},
    analytics: {
        messagesSent: 0,
        clubsJoined: 0,
        postsCreated: 0,
        pageViews: 0,
    },
};

// Configuration constants
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000',
    MAX_TOPICS: 3,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
    NOTIFICATION_TIMEOUT: 5000,
    SOCKET_RECONNECTION_ATTEMPTS: 5,
    SOCKET_RECONNECTION_DELAY: 2000,
    MAX_MESSAGE_LENGTH: 5000,
    MAX_CLUB_NAME_LENGTH: 100,
    MAX_CLUB_TITLE_LENGTH: 200,
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_RULES_LENGTH: 1000,
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    RATE_LIMIT_MAX: 50,
    TOPIC_SUGGESTIONS: ['Technology', 'Gaming', 'Books', 'Movies', 'Music', 'Sports', 'Art', 'Science', 'Travel', 'Food'],
};

// DOM element cache
const DOM = {
    get: (id) => document.getElementById(id),
    query: (selector) => document.querySelector(selector),
    queryAll: (selector) => document.querySelectorAll(selector),
};

// Utility functions
/**
 * Debounce a function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Throttle a function to limit execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum interval in milliseconds
 * @returns {Function} Throttled function
 */
const throttle = (func, limit) => {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

/**
 * Execute an async function with error handling
 * @param {Function} fn - Async function to execute
 * @param {string} errorMessage - Error message to display
 * @param {Object} [options={}] - Options (e.g., silent: true)
 * @returns {Promise<any>} Result of the function
 */
const safeExecute = async (fn, errorMessage, options = {}) => {
    try {
        const result = await fn();
        logEvent('success', errorMessage, { result });
        return result;
    } catch (error) {
        logEvent('error', errorMessage, { error: error.message });
        if (!options.silent) {
            showNotification(`${errorMessage}: ${error.message}`, 'error');
        }
        throw error;
    }
};

/**
 * Sanitize input to prevent XSS
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: ['b', 'i', 'p', 'br'] });
};

/**
 * Generate a UUID v4
 * @returns {string} UUID
 */
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted timestamp
 */
const formatTimestamp = (timestamp) => {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch (error) {
        logEvent('error', 'Failed to format timestamp', { error });
        return 'Invalid Date';
    }
};

/**
 * Log events for debugging and analytics
 * @param {string} type - Log type (info, error, success)
 * @param {string} message - Log message
 * @param {Object} [data={}] - Additional data
 */
const logEvent = (type, message, data = {}) => {
    console[type === 'error' ? 'error' : type === 'success' ? 'info' : 'log'](
        `[${type.toUpperCase()}] ${message}`,
        JSON.stringify({ timestamp: new Date().toISOString(), ...data }, null, 2)
    );
    if (type === 'success') {
        state.analytics[message] = (state.analytics[message] || 0) + 1;
    }
};

/**
 * Check rate limit for an action
 * @param {string} actionKey - Action identifier
 * @returns {boolean} Whether action is allowed
 */
const checkRateLimit = (actionKey) => {
    const now = Date.now();
    if (!state.rateLimits[actionKey]) {
        state.messageData[actionKey] = { count: 1, timestamp: now };
        return true;
    }
    const limit = state.rateLimits[actionKey];
    if (now - limit.timestamp > CONFIG.RATE_LIMIT_WINDOW) {
        limit.count = 1;
        limit.timestamp = now;
        return true;
    }
    if (limit.count >= CONFIG.RATE_LIMIT_MAX) {
        showNotification('Rate limit exceeded. Please try again later.', 'error');
        return false;
    }
    limit.count++;
    return true;
};

// API Request Handler
/**
 * Make an API request with authentication
 * @param {string} endpoint - API endpoint
 * @param {Object} [options={}] - Fetch options
 * @returns {Promise<any>} API response
 */
async function apiRequest(endpoint, options = {}) {
    if (!checkRateLimit(`api_${endpoint}`)) {
        throw new Error('Rate limit exceeded');
    }
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    logEvent('info', `API Request: ${endpoint}`, { headers: !!token });
    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || response.statusText);
    }
    const contentType = response.headers.get('content-type');
    return contentType?.includes('application/json') ? response.json() : response;
}

// Navigation
/**
 * Navigate to a URL with authentication check
 * @param {string} url - Destination URL
 */
function navigateTo(url) {
    if (!localStorage.getItem('token') && url !== '/index.html') {
        showNotification('Please log in to access this page.', 'error');
        window.location.href = '/index.html';
        return;
    }
    window.location.href = url;
    state.analytics.pageViews++;
}

// Socket.IO Initialization
/**
 * Initialize Socket.IO with authentication
 * @returns {boolean} Initialization success
 */
function initializeSocketIO() {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please log in to access chat features.', 'error');
        navigateTo('/index.html');
        return false;
    }
    try {
        state.socket = io(CONFIG.API_BASE_URL, {
            auth: { token, userId: state.currentUserId },
            reconnectionAttempts: CONFIG.SOCKET_RECONNECTION_ATTEMPTS,
            reconnectionDelay: CONFIG.SOCKET_RECONNECTION_DELAY,
        });
        state.socket.on('connect', () => {
            logEvent('success', 'Socket.IO connected');
            if (state.currentClubId) {
                state.socket.emit('joinClub', { clubId: state.currentClubId, userId: state.currentUserId });
            }
        });
        state.socket.on('connect_error', (err) => {
            logEvent('error', 'Socket.IO connection error', { error: err.message });
            showNotification(
                err.message.includes('401') ? 'Authentication failed.' : 'Failed to connect to server.',
                'error'
            );
            if (err.message.includes('401')) navigateTo('/index.html');
        });
        state.socket.on('message', ({ clubId, message }) => {
            if (clubId === state.currentClubId) {
                saveMessage(clubId, message);
                renderChatMessages();
            }
        });
        state.socket.on('clubCreated', (club) => {
            state.clubData.push(club);
            localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
            renderClubList();
        });
        state.socket.on('messageUpdated', ({ clubId, messageId, updatedMessage }) => {
            updateMessage(clubId, messageId, updatedMessage);
            if (clubId === state.currentClubId) renderChatMessages();
        });
        state.socket.on('messageDeleted', ({ clubId, messageId }) => {
            deleteMessage(clubId, messageId);
            if (clubId === state.currentClubId) renderChatMessages();
        });
        state.socket.on('clubDeleted', ({ clubId }) => {
            state.clubData = state.clubData.filter(club => club.id !== clubId);
            localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
            if (state.currentClubId === clubId) {
                state.currentClubId = null;
                localStorage.removeItem('currentClubId');
                showNoClubsState();
            }
            renderClubList();
        });
        state.isSocketInitialized = true;
        return true;
    } catch (error) {
        logEvent('error', 'Socket.IO initialization failed', { error });
        showNotification('Failed to initialize chat system.', 'error');
        return false;
    }
}

// Notification System
/**
 * Display a notification
 * @param {string} message - Notification message
 * @param {string} [type='info'] - Type (info, success, error)
 * @param {number} [timeout=CONFIG.NOTIFICATION_TIMEOUT] - Duration in ms
 */
function showNotification(message, type = 'info', timeout = CONFIG.NOTIFICATION_TIMEOUT) {
    const notification = DOM.get('notification');
    if (!notification) return;
    notification.textContent = sanitizeInput(message);
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, timeout);
    if (Notification.permission === 'granted') {
        new Notification('Chat.me', { body: message, icon: '/assets/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('Chat.me', { body: message, icon: '/assets/favicon.ico' });
            }
        });
    }
}

// Modal Management
/**
 * Toggle a modal's visibility
 * @param {string} modalId - Modal ID
 * @param {boolean} show - Show or hide
 */
function toggleModal(modalId, show) {
    const modal = DOM.get(modalId);
    if (!modal) {
        logEvent('error', `Modal ${modalId} not found`);
        return;
    }
    let overlay = DOM.query('.modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }
    if (show) {
        modal.showModal();
        modal.classList.add('active');
        overlay.classList.add('active');
        modal.querySelector('input, button, [tabindex="0"]')?.focus();
    } else {
        modal.close();
        modal.classList.remove('active');
        overlay.classList.remove('active');
        if (modalId === 'create-club-modal') resetCreateClubModal();
        if (modalId === 'edit-message-modal') DOM.get('edit-message-form')?.reset();
        if (modalId === 'post-form-modal') DOM.get('post-form-create')?.reset();
    }
}

/**
 * Reset the create club modal
 */
function resetCreateClubModal() {
    const form = DOM.get('create-club-form');
    if (!form) return;
    form.reset();
    state.selectedTopics = [];
    state.currentCreateClubPage = 1;
    DOM.get('banner-preview-img').src = '/assets/default-banner.jpg';
    DOM.get('preview-image-img').src = '/assets/default-image.jpg';
    DOM.get('selected-topics-list').innerHTML = '';
    DOM.get('topics-list-div').innerHTML = '';
    updateCreateClubModalPage();
}

/**
 * Update create club modal page
 */
function updateCreateClubModalPage() {
    const pages = DOM.queryAll('.modal-page, .modal-page-topics');
    const progressSteps = DOM.queryAll('.progress-step-club');
    const prevBtn = DOM.get('prev-page-btn-club');
    const nextBtn = DOM.get('next-page-btn');
    const createBtn = DOM.get('create-club-btn');
    pages.forEach((page, index) => {
        page.hidden = index + 1 !== state.currentCreateClubPage;
    });
    progressSteps.forEach((step, index) => {
        step.classList.toggle('active', index + 1 === state.currentCreateClubPage);
    });
    prevBtn.hidden = state.currentCreateClubPage === 1;
    nextBtn.hidden = state.currentCreateClubPage === 4;
    createBtn.hidden = state.currentCreateClubPage !== 4;
}

/**
 * Navigate create club modal pages
 * @param {number} direction - 1 for next, -1 for previous
 */
function navigateCreateClubModal(direction) {
    const newPage = state.currentCreateClubPage + direction;
    if (newPage < 1 || newPage > 4) return;
    if (direction === 1 && !validateCreateClubPage(state.currentCreateClubPage)) return;
    state.currentCreateClubPage = newPage;
    updateCreateClubModalPage();
}

// Club Management
/**
 * Load and display club details
 * @param {string} clubId - Club ID
 */
async function loadClub(clubId) {
    const clubContainer = DOM.get('club-info-section');
    const topSection = DOM.get('top-section');
    const mainContent = DOM.get('main-content');
    const noClubs = DOM.get('no-clubs');
    if (!clubContainer || !topSection || !mainContent || !noClubs) return;
    if (!clubId) {
        showNoClubsState();
        return;
    }
    clubContainer.className = 'club-info-section-info loading';
    clubContainer.innerHTML = '<div class="loading">Loading club data...</div><div class="loading-spinner active"></div>';
    topSection.style.display = 'none';
    mainContent.style.display = 'none';
    noClubs.style.display = 'none';
    await safeExecute(async () => {
        const club = await apiRequest(`/api/clubs/${clubId}`);
        state.clubData = state.clubData.some(c => c.id === clubId)
            ? state.clubData.map(c => (c.id === clubId ? club : c))
            : [...state.clubData, club];
        localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
        const isMember = club.members?.includes(state.currentUserId) || false;
        const isCreator = club.creator?.id === state.currentUserId;
        clubContainer.className = 'club-info-section-info';
        clubContainer.innerHTML = `
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)} logo" />
            <h2>${sanitizeInput(club.title || club.name)}</h2>
            <p>${sanitizeInput(club.description || 'No description provided.')}</p>
            <p><strong>Type:</strong> ${sanitizeInput(club.type?.charAt(0).toUpperCase() + club.type?.slice(1) || 'Public')}</p>
            <p><strong>Members:</strong> ${club.members?.length || 0}</p>
            <p><strong>Online:</strong> ${club.online || 0}</p>
            <p><strong>Created by:</strong> ${sanitizeInput(club.creator?.username || 'Unknown')}</p>
            <p class="membership-status"><strong>Status:</strong> ${isMember ? 'Member' : 'Not a Member'}</p>
            ${club.rules?.length ? `
                <h3>Rules</h3>
                <ul class="club-rules">${club.rules.map(rule => `<li>${sanitizeInput(rule)}</li>`).join('')}</ul>
            ` : ''}
        `;
        updateClubUI(club);
        topSection.style.display = 'block';
        mainContent.style.display = 'flex';
        state.currentClubId = clubId;
        localStorage.setItem('currentClubId', clubId);
        if (state.isSocketInitialized) {
            state.socket.emit('joinClub', { clubId, userId: state.currentUserId });
        }
        renderChatMessages();
    }, 'Failed to load club details', { silent: true });
    clubContainer.className = 'club-info-section-info error';
    clubContainer.innerHTML = '<p>Failed to load club. <a href="/main.html" data-navigate="/main.html">Return to main page</a>.</p>';
}

/**
 * Update club UI elements
 * @param {Object} club - Club object
 */
function updateClubUI(club) {
    const elements = {
        title: DOM.get('club-title'),
        logo: DOM.get('logo-img'),
        banner: DOM.get('club-top-img'),
        joinBtn: DOM.get('join-club-btn'),
        deleteBtn: DOM.get('delete-club-option'),
    };
    if (elements.title) elements.title.textContent = sanitizeInput(club.title || club.name);
    if (elements.logo) elements.logo.src = sanitizeInput(club.image || '/assets/default-club-image.jpg');
    if (elements.banner) elements.banner.src = sanitizeInput(club.banner || '/assets/default-banner.jpg');
    if (elements.joinBtn) elements.joinBtn.hidden = club.members?.includes(state.currentUserId) || false;
    if (elements.deleteBtn) elements.deleteBtn.hidden = club.creator?.id !== state.currentUserId;
}

/**
 * Show no clubs state
 */
function showNoClubsState() {
    const noClubs = DOM.get('no-clubs');
    const topSection = DOM.get('top-section');
    const mainContent = DOM.get('main-content');
    if (noClubs && topSection && mainContent) {
        noClubs.style.display = 'flex';
        topSection.style.display = 'none';
        mainContent.style.display = 'none';
    }
}

// Chat Management
/**
 * Save a message to localStorage
 * @param {string} clubId - Club ID
 * @param {Object} message - Message object
 */
function saveMessage(clubId, message) {
    state.messageData[clubId] = state.messageData[clubId] || [];
    state.messageData[clubId].push(message);
    localStorage.setItem(`chat_${clubId}_${state.currentUserId}`, JSON.stringify(state.messageData[clubId]));
}

/**
 * Update a message
 * @param {string} clubId - Club ID
 * @param {string} messageId - Message ID
 * @param {Object} updatedMessage - Updated message
 */
function updateMessage(clubId, messageId, updatedMessage) {
    state.messageData[clubId] = state.messageData[clubId] || [];
    const index = state.messageData[clubId].findIndex(msg => msg.id === messageId);
    if (index !== -1) {
        state.messageData[clubId][index] = { ...state.messageData[clubId][index], ...updatedMessage };
        localStorage.setItem(`chat_${clubId}_${state.currentUserId}`, JSON.stringify(state.messageData[clubId]));
    }
}

/**
 * Delete a message
 * @param {string} clubId - Club ID
 * @param {string} messageId - Message ID
 */
function deleteMessage(clubId, messageId) {
    state.messageData[clubId] = state.messageData[clubId] || [];
    state.messageData[clubId] = state.messageData[clubId].filter(msg => msg.id !== messageId);
    localStorage.setItem(`chat_${clubId}_${state.currentUserId}`, JSON.stringify(state.messageData[clubId]));
}

/**
 * Render chat messages
 */
const renderChatMessages = debounce(() => {
    const messagesEl = DOM.get('chat-messages');
    if (!messagesEl || !state.currentClubId) return;
    state.messageData[state.currentClubId] = JSON.parse(localStorage.getItem(`chat_${state.currentClubId}_${state.currentUserId}`)) || [];
    const messages = state.messageData[state.currentClubId];
    messagesEl.innerHTML = messages.length
        ? messages.map((msg, index) => `
            <div class="chat-message ${msg.senderId === state.currentUserId ? 'own' : ''}" data-message-id="${msg.id || index}">
                <span class="sender">${sanitizeInput(msg.sender || 'Anonymous')}</span>
                <p>${sanitizeInput(msg.text)}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Shared image" loading="lazy" />` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls preload="metadata"></video>` : ''}
                ${msg.pinned ? '<span class="pinned">📌 Pinned</span>' : ''}
                ${msg.reactions ? `
                    <div class="reactions">${Object.entries(msg.reactions)
                        .map(([emoji, count]) => `<span data-emoji="${emoji}">${emoji} ${count}</span>`)
                        .join('')}</div>
                ` : ''}
                ${msg.senderId === state.currentUserId ? `
                    <span class="message-menu" data-message-id="${msg.id || index}" aria-label="Message options">
                        <i class="fas fa-ellipsis-v" aria-hidden="true"></i>
                    </span>
                    <div class="message-menu-content" id="message-menu-${msg.id || index}">
                        <div data-action="editMessage" data-message-id="${msg.id || index}">Edit</div>
                        <div data-action="deleteMessage" data-message-id="${msg.id || index}">Delete</div>
                        <div data-action="pinMessage" data-message-id="${msg.id || index}">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                    </div>
                ` : ''}
            </div>
        `).join('')
        : '<p class="text-center" style="color: var(--text-muted);">No messages yet. Start the conversation!</p>';
    messagesEl.scrollTop = messagesEl.scrollHeight;
}, 100);

// Club Creation
/**
 * Validate create club form page
 * @param {number} page - Page number
 * @returns {boolean} Validation result
 */
function validateCreateClubPage(page) {
    let isValid = true;
    const errors = [];
    if (page === 1) {
        const name = DOM.get('club-name-input')?.value.trim();
        const title = DOM.get('club-title-input')?.value.trim();
        const desc = DOM.get('club-desc')?.value.trim();
        const rules = DOM.get('submission-textarea')?.value.trim();
        if (!name) {
            errors.push({ id: 'club-name-error', message: 'Club name is required' });
            isValid = false;
        } else if (name.length > CONFIG.MAX_CLUB_NAME_LENGTH) {
            errors.push({ id: 'club-name-error', message: `Name cannot exceed ${CONFIG.MAX_CLUB_NAME_LENGTH} characters` });
            isValid = false;
        } else if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            errors.push({ id: 'club-name-error', message: 'Name can only contain letters, numbers, and underscores' });
            isValid = false;
        } else if (state.clubData.some(club => club.name.toLowerCase() === name.toLowerCase())) {
            errors.push({ id: 'club-name-error', message: 'Club name must be unique' });
            isValid = false;
        }
        if (title && title.length > CONFIG.MAX_CLUB_TITLE_LENGTH) {
            errors.push({ id: 'club-title-error', message: `Title cannot exceed ${CONFIG.MAX_CLUB_TITLE_LENGTH} characters` });
            isValid = false;
        }
        if (desc.length > CONFIG.MAX_DESCRIPTION_LENGTH) {
            errors.push({ id: 'club-desc-error', message: `Description cannot exceed ${CONFIG.MAX_DESCRIPTION_LENGTH} characters` });
            isValid = false;
        }
        if (rules.length > CONFIG.MAX_RULES_LENGTH) {
            errors.push({ id: 'club-submission-error', message: `Rules cannot exceed ${CONFIG.MAX_RULES_LENGTH} characters` });
            isValid = false;
        }
    } else if (page === 2) {
        const banner = DOM.get('banner-file-input')?.files[0];
        const image = DOM.get('image-file-input')?.files[0];
        if (banner && !validateFile(banner, 'image')) {
            errors.push({ id: 'banner-error', message: 'Invalid banner file' });
            isValid = false;
        }
        if (image && !validateFile(image, 'image')) {
            errors.push({ id: 'image-error', message: 'Invalid image file' });
            isValid = false;
        }
    } else if (page === 3) {
        if (state.selectedTopics.length === 0) {
            errors.push({ id: 'topics-error-list', message: 'At least one topic is required' });
            isValid = false;
        }
    }
    errors.forEach(({ id, message }) => {
        const errorEl = DOM.get(id);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('active');
        }
    });
    if (errors.length) showNotification('Please fix form errors before proceeding.', 'error');
    return isValid;
}

/**
 * Handle club creation
 * @param {Event} e - Form submission event
 */
async function handleClubCreation(e) {
    e.preventDefault();
    if (!validateCreateClubPage(state.currentCreateClubPage)) return;
    const form = DOM.get('create-club-form');
    if (!form) return;
    const formData = new FormData(form);
    const bannerFile = formData.get('banner');
    const imageFile = formData.get('image');
    const [bannerBase64, imageBase64] = await Promise.all([
        readFileAsBase64(bannerFile),
        readFileAsBase64(imageFile),
    ]);
    const newClub = {
        id: generateUUID(),
        name: sanitizeInput(formData.get('name')?.trim()),
        title: sanitizeInput(formData.get('title')?.trim() || formData.get('name')?.trim()),
        description: sanitizeInput(formData.get('description')?.trim()),
        rules: sanitizeInput(formData.get('submission')?.trim()).split('\n').filter(Boolean),
        type: formData.get('type') || 'public',
        mature: formData.get('mature') === 'on',
        wiki: formData.get('wiki') === 'on',
        spamFilter: formData.get('spam') || 'medium',
        contentOptions: {
            text: formData.get('content-text') === 'on',
            images: formData.get('content-images') === 'on',
            links: formData.get('content-links') === 'on',
            polls: formData.get('content-polls') === 'on',
        },
        discoverable: formData.get('discoverable') === 'on',
        flair: formData.get('post-flair') === 'on',
        nsfwTags: formData.get('nsfw-tags') === 'on',
        spoilerTags: formData.get('spoiler-tags') === 'on',
        topics: state.selectedTopics,
        banner: bannerBase64 || '/assets/default-banner.jpg',
        image: imageBase64 || '/assets/default-image.jpg',
        creator: { id: state.currentUserId, username: state.currentUsername },
        members: [state.currentUserId],
        online: 0,
        moderators: [state.currentUserId],
        createdAt: new Date().toISOString(),
    };
    await safeExecute(async () => {
        const createdClub = await apiRequest('/api/clubs', {
            method: 'POST',
            body: JSON.stringify(newClub),
        });
        state.clubData.push(createdClub);
        localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
        if (state.isSocketInitialized) {
            state.socket.emit('clubCreated', createdClub);
        }
        toggleModal('create-club-modal', false);
        selectClub(createdClub.id);
        showNotification('Club created successfully!', 'success');
    }, 'Failed to create club');
}

/**
 * Handle club deletion
 * @param {string} clubId - Club ID
 */
async function deleteClub(clubId) {
    const club = state.clubData.find(c => c.id === clubId);
    if (!club || club.creator?.id !== state.currentUserId) {
        showNotification('You do not have permission to delete this club.', 'error');
        return;
    }
    if (!confirm(`Are you sure you want to delete ${club.name}? This action cannot be undone.`)) return;
    await safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, { method: 'DELETE' });
        state.clubData = state.clubData.filter(c => c.id !== clubId);
        localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
        if (state.isSocketInitialized) {
            state.socket.emit('clubDeleted', { clubId });
        }
        if (state.currentClubId === clubId) {
            state.currentClubId = null;
            localStorage.removeItem('currentClubId');
            showNoClubsState();
        }
        renderClubList();
        showNotification('Club deleted successfully.', 'success');
    }, 'Failed to delete club');
}

// Join Club
/**
 * Handle join club form submission
 * @param {Event} e - Form submission event
 */
async function handleJoinClub(e) {
    e.preventDefault();
    const form = DOM.get('join-club-form');
    if (!form) return;
    const inviteCode = form.querySelector('#invite-code-input').value.trim();
    if (!inviteCode) {
        DOM.get('invite-code-error').textContent = 'Invite code is required';
        DOM.get('invite-code-error').classList.add('active');
        return;
    }
    await safeExecute(async () => {
        const club = await apiRequest(`/api/clubs/join`, {
            method: 'POST',
            body: JSON.stringify({ inviteCode, userId: state.currentUserId }),
        });
        state.clubData = state.clubData.some(c => c.id === club.id)
            ? state.clubData.map(c => (c.id === club.id ? club : c))
            : [...state.clubData, club];
        localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
        toggleModal('join-club-modal', false);
        selectClub(club.id);
        state.analytics.clubsJoined++;
        showNotification(`Joined ${sanitizeInput(club.name)} successfully!`, 'success');
    }, 'Failed to join club');
}

// Post Creation
/**
 * Handle post creation
 * @param {Event} e - Form submission event
 */
async function handlePostCreation(e) {
    e.preventDefault();
    if (!state.currentClubId) {
        showNotification('No club selected.', 'error');
        return;
    }
    const form = DOM.get('post-form-create');
    if (!form) return;
    const formData = new FormData(form);
    const title = formData.get('post-title')?.trim();
    const content = formData.get('post-content')?.trim();
    const media = formData.get('post-media');
    if (!title) {
        DOM.get('post-title-error').textContent = 'Title is required';
        DOM.get('post-title-error').classList.add('active');
        return;
    }
    if (media && !validateFile(media, media.type.includes('video') ? 'video' : 'image')) {
        DOM.get('post-media-error').textContent = 'Invalid media file';
        DOM.get('post-media-error').classList.add('active');
        return;
    }
    const mediaBase64 = await readFileAsBase64(media);
    const post = {
        id: generateUUID(),
        clubId: state.currentClubId,
        creatorId: state.currentUserId,
        creatorUsername: state.currentUsername,
        title: sanitizeInput(title),
        content: sanitizeInput(content),
        media: mediaBase64,
        mediaType: media?.type?.includes('video') ? 'video' : media?.type?.includes('image') ? 'image' : null,
        createdAt: new Date().toISOString(),
        reactions: {},
        comments: [],
    };
    await safeExecute(async () => {
        await apiRequest(`/api/clubs/${state.currentClubId}/posts`, {
            method: 'POST',
            body: JSON.stringify(post),
        });
        if (state.isSocketInitialized) {
            state.socket.emit('postCreated', post);
        }
        toggleModal('post-form-modal', false);
        state.analytics.postsCreated++;
        showNotification('Post created successfully!', 'success');
    }, 'Failed to create post');
}

// Message Management
/**
 * Handle sending a message
 * @param {Event} e - Form submission event
 */
async function handleSendMessage(e) {
    e.preventDefault();
    if (!checkRateLimit('sendMessage')) return;
    if (!state.currentClubId) {
        showNotification('No club selected.', 'error');
        return;
    }
    const form = DOM.get('chat-form');
    const textInput = DOM.get('chat-input-text');
    const mediaInput = DOM.get('chat-media-input-file');
    if (!form || !textInput) return;
    const text = textInput.value.trim();
    const mediaFile = mediaInput?.files[0];
    if (!text && !mediaFile) {
        showNotification('Message or media is required.', 'error');
        return;
    }
    if (text.length > CONFIG.MAX_MESSAGE_LENGTH) {
        showNotification(`Message cannot exceed ${CONFIG.MAX_MESSAGE_LENGTH} characters.`, 'error');
        return;
    }
    if (mediaFile && !validateFile(mediaFile, mediaFile.type.includes('video') ? 'video' : 'image')) {
        mediaInput.value = '';
        return;
    }
    const message = {
        id: generateUUID(),
        clubId: state.currentClubId,
        senderId: state.currentUserId,
        sender: state.currentUsername,
        text: sanitizeInput(text),
        timestamp: new Date().toISOString(),
        reactions: {},
    };
    if (mediaFile) {
        const mediaBase64 = await readFileAsBase64(mediaFile);
        if (mediaFile.type.includes('image')) {
            message.image = mediaBase64;
        } else if (mediaFile.type.includes('video')) {
            message.video = mediaBase64;
        }
    }
    await safeExecute(async () => {
        if (state.isSocketInitialized) {
            state.socket.emit('message', { clubId: state.currentClubId, message });
        }
        saveMessage(state.currentClubId, message);
        renderChatMessages();
        textInput.value = '';
        mediaInput.value = '';
        state.analytics.messagesSent++;
    }, 'Failed to send message');
}

/**
 * Edit a message
 * @param {string} messageId - Message ID
 */
function editMessage(messageId) {
    if (!state.currentClubId) return;
    const message = state.messageData[state.currentClubId]?.find(msg => msg.id === messageId);
    if (!message || message.senderId !== state.currentUserId) {
        showNotification('Cannot edit this message.', 'error');
        return;
    }
    const editInput = DOM.get('edit-message-text');
    if (editInput) {
        editInput.value = message.text;
        toggleModal('edit-message-modal', true);
        DOM.get('edit-message-form').dataset.messageId = messageId;
    }
}

/**
 * Handle message edit submission
 * @param {Event} e - Form submission event
 */
async function handleEditMessage(e) {
    e.preventDefault();
    if (!state.currentClubId) return;
    const form = DOM.get('edit-message-form');
    const messageId = form?.dataset.messageId;
    const text = DOM.get('edit-message-text')?.value.trim();
    if (!messageId || !text) {
        DOM.get('edit-message-error').textContent = 'Message is required';
        DOM.get('edit-message-error').classList.add('active');
        return;
    }
    if (text.length > CONFIG.MAX_MESSAGE_LENGTH) {
        DOM.get('edit-message-error').textContent = `Message cannot exceed ${CONFIG.MAX_MESSAGE_LENGTH} characters`;
        DOM.get('edit-message-error').classList.add('active');
        return;
    }
    const updatedMessage = { text: sanitizeInput(text), editedAt: new Date().toISOString() };
    await safeExecute(async () => {
        await apiRequest(`/api/clubs/${state.currentClubId}/messages/${messageId}`, {
            method: 'PATCH',
            body: JSON.stringify(updatedMessage),
        });
        updateMessage(state.currentClubId, messageId, updatedMessage);
        if (state.isSocketInitialized) {
            state.socket.emit('messageUpdated', { clubId: state.currentClubId, messageId, updatedMessage });
        }
        renderChatMessages();
        toggleModal('edit-message-modal', false);
        showNotification('Message updated successfully.', 'success');
    }, 'Failed to update message');
}

/**
 * Delete a message
 * @param {string} messageId - Message ID
 */
async function handleDeleteMessage(messageId) {
    if (!state.currentClubId) return;
    const message = state.messageData[state.currentClubId]?.find(msg => msg.id === messageId);
    if (!message || message.senderId !== state.currentUserId) {
        showNotification('Cannot delete this message.', 'error');
        return;
    }
    if (!confirm('Are you sure you want to delete this message?')) return;
    await safeExecute(async () => {
        await apiRequest(`/api/clubs/${state.currentClubId}/messages/${messageId}`, { method: 'DELETE' });
        deleteMessage(state.currentClubId, messageId);
        if (state.isSocketInitialized) {
            state.socket.emit('messageDeleted', { clubId: state.currentClubId, messageId });
        }
        renderChatMessages();
        showNotification('Message deleted successfully.', 'success');
    }, 'Failed to delete message');
}

/**
 * Pin or unpin a message
 * @param {string} messageId - Message ID
 */
async function pinMessage(messageId) {
    if (!state.currentClubId) return;
    const message = state.messageData[state.currentClubId]?.find(msg => msg.id === messageId);
    if (!message) {
        showNotification('Message not found.', 'error');
        return;
    }
    const club = state.clubData.find(c => c.id === state.currentClubId);
    if (!club?.moderators?.includes(state.currentUserId)) {
        showNotification('Only moderators can pin messages.', 'error');
        return;
    }
    const isPinned = !!message.pinned;
    await safeExecute(async () => {
        const updatedMessage = { pinned: !isPinned };
        await apiRequest(`/api/clubs/${state.currentClubId}/messages/${messageId}`, {
            method: 'PATCH',
            body: JSON.stringify(updatedMessage),
        });
        updateMessage(state.currentClubId, messageId, updatedMessage);
        if (state.isSocketInitialized) {
            state.socket.emit('messageUpdated', { clubId: state.currentClubId, messageId, updatedMessage });
        }
        renderChatMessages();
        showNotification(`Message ${isPinned ? 'unpinned' : 'pinned'} successfully.`, 'success');
    }, `Failed to ${isPinned ? 'unpin' : 'pin'} message`);
}

// User Profile Management
/**
 * Handle user profile update
 * @param {Event} e - Form submission event
 */
async function handleProfileUpdate(e) {
    e.preventDefault();
    const form = DOM.get('edit-profile-form');
    if (!form) return;
    const formData = new FormData(form);
    const username = formData.get('username')?.trim();
    const avatarFile = formData.get('avatar');
    if (!username) {
        DOM.get('username-error').textContent = 'Username is required';
        DOM.get('username-error').classList.add('active');
        return;
    }
    if (avatarFile && !validateFile(avatarFile, 'image')) {
        DOM.get('avatar-error').textContent = 'Invalid avatar file';
        DOM.get('avatar-error').classList.add('active');
        return;
    }
    const avatarBase64 = await readFileAsBase64(avatarFile);
    await safeExecute(async () => {
        const updatedUser = await apiRequest(`/api/users/${state.currentUserId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                username: sanitizeInput(username),
                avatar: avatarBase64,
            }),
        });
        state.currentUsername = updatedUser.username;
        localStorage.setItem('currentUsername', updatedUser.username);
        toggleModal('user-profile-modal', false);
        showNotification('Profile updated successfully!', 'success');
    }, 'Failed to update profile');
}

// Topic Management
/**
 * Render topic suggestions
 */
function renderTopicSuggestions() {
    const topicList = DOM.get('topics-list-div');
    const searchInput = DOM.get('topic-search-input');
    if (!topicList || !searchInput) return;
    const searchTerm = searchInput.value.trim().toLowerCase();
    const filteredTopics = CONFIG.TOPIC_SUGGESTIONS.filter(
        topic => !state.selectedTopics.includes(topic) && topic.toLowerCase().includes(searchTerm)
    );
    topicList.innerHTML = filteredTopics.map(topic => `
        <div class="topic-item" data-topic="${sanitizeInput(topic)}" role="option">
            ${sanitizeInput(topic)}
        </div>
    `).join('');
}

/**
 * Handle topic selection
 * @param {string} topic - Topic name
 */
function handleTopicSelection(topic) {
    if (state.selectedTopics.length >= CONFIG.MAX_TOPICS && !state.selectedTopics.includes(topic)) {
        showNotification(`You can select up to ${CONFIG.MAX_TOPICS} topics.`, 'error');
        return;
    }
    if (state.selectedTopics.includes(topic)) {
        state.selectedTopics = state.selectedTopics.filter(t => t !== topic);
    } else {
        state.selectedTopics.push(topic);
    }
    const selectedList = DOM.get('selected-topics-list');
    if (selectedList) {
        selectedList.innerHTML = state.selectedTopics.map(t => `
            <div class="topic-item selected" data-topic="${sanitizeInput(t)}">
                ${sanitizeInput(t)}
                <span class="remove-topic" data-topic="${sanitizeInput(t)}">&times;</span>
            </div>
        `).join('');
    }
    renderTopicSuggestions();
}

// File Handling
/**
 * Read file as base64
 * @param {File} file - File to read
 * @returns {Promise<string|null>} Base64 string
 */
function readFileAsBase64(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

/**
 * Validate file
 * @param {File} file - File to validate
 * @param {string} type - 'image' or 'video'
 * @returns {boolean} Validation result
 */
function validateFile(file, type) {
    if (!file) return true;
    const allowedTypes = type === 'video' ? CONFIG.ALLOWED_VIDEO_TYPES : CONFIG.ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(file.type)) {
        showNotification(`Only ${allowedTypes.join(', ')} files are allowed.`, 'error');
        return false;
    }
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showNotification('File size exceeds 50MB.', 'error');
        return false;
    }
    return true;
}

// Club List Rendering
/**
 * Render club list
 */
async function renderClubList() {
    const lists = {
        myClubs: DOM.get('my-clubs-list'),
        joinedClubs: DOM.get('joined-clubs-list'),
        availableClubs: DOM.get('available-clubs-list'),
        empty: DOM.get('club-list-empty'),
    };
    if (!lists.myClubs || !lists.joinedClubs || !lists.availableClubs || !lists.empty) return;
    await safeExecute(async () => {
        const clubs = await apiRequest('/api/clubs');
        state.clubData = clubs;
        localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
        const myClubs = clubs.filter(club => club.creator?.id === state.currentUserId);
        const joinedClubs = clubs.filter(
            club => club.members?.includes(state.currentUserId) && club.creator?.id !== state.currentUserId
        );
        const availableClubs = clubs.filter(
            club => !club.members?.includes(state.currentUserId) && club.type === 'public'
        );
        lists.myClubs.innerHTML = myClubs.map(club => renderClubItem(club)).join('');
        lists.joinedClubs.innerHTML = joinedClubs.map(club => renderClubItem(club)).join('');
        lists.availableClubs.innerHTML = availableClubs.map(club => renderClubItem(club)).join('');
        lists.empty.hidden = myClubs.length + joinedClubs.length + availableClubs.length > 0;
        DOM.get('club-list').hidden = myClubs.length + joinedClubs.length + availableClubs.length === 0;
    }, 'Failed to load clubs', { silent: true });
}

/**
 * Render a club item
 * @param {Object} club - Club object
 * @returns {string} HTML string
 */
function renderClubItem(club) {
    const isSelected = club.id === state.currentClubId;
    return `
        <div class="club-item ${isSelected ? 'selected' : ''}" data-club-id="${sanitizeInput(club.id)}" role="option">
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)} logo" loading="lazy" />
            <div>
                <h4>${sanitizeInput(club.title || club.name)}</h4>
                <p>${sanitizeInput(club.description?.slice(0, 50) || 'No description')}...</p>
            </div>
        </div>
    `;
}

/**
 * Select a club
 * @param {string} clubId - Club ID
 */
function selectClub(clubId) {
    state.currentClubId = clubId;
    localStorage.setItem('currentClubId', clubId);
    loadClub(clubId);
    renderClubList();
    renderChatMessages();
}

// Moderation Tools
/**
 * Ban a user from a club
 * @param {string} userId - User ID
 */
async function banUser(userId) {
    if (!state.currentClubId) return;
    const club = state.clubData.find(c => c.id === state.currentClubId);
    if (!club?.moderators?.includes(state.currentUserId)) {
        showNotification('Only moderators can ban users.', 'error');
        return;
    }
    if (!confirm('Are you sure you want to ban this user?')) return;
    await safeExecute(async () => {
        await apiRequest(`/api/clubs/${state.currentClubId}/ban`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
        state.clubData = state.clubData.map(c =>
            c.id === state.currentClubId ? { ...c, members: c.members.filter(id => id !== userId) } : c
        );
        localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
        showNotification('User banned successfully.', 'success');
    }, 'Failed to ban user');
}

// Event Listeners
/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Navigation
    DOM.queryAll('[data-navigate]').forEach(btn =>
        btn.addEventListener('click', () => navigateTo(btn.dataset.navigate))
    );
    // Modals
    DOM.get('create-club-nav-btn')?.addEventListener('click', () => toggleModal('create-club-modal', true));
    DOM.get('create-club-no-club-btn')?.addEventListener('click', () => toggleModal('create-club-modal', true));
    DOM.get('create-club-form')?.addEventListener('submit', handleClubCreation);
    DOM.get('cancel-btn')?.addEventListener('click', () => toggleModal('create-club-modal', false));
    DOM.get('create-club-close-btn')?.addEventListener('click', () => toggleModal('create-club-modal', false));
    DOM.get('prev-page-btn-club')?.addEventListener('click', () => navigateCreateClubModal(-1));
    DOM.get('next-page-btn')?.addEventListener('click', () => navigateCreateClubModal(1));
    DOM.get('join-club-btn')?.addEventListener('click', () => toggleModal('join-club-modal', true));
    DOM.get('join-club-form')?.addEventListener('submit', handleJoinClub);
    DOM.get('join-cancel-btn')?.addEventListener('click', () => toggleModal('join-club-modal', false));
    DOM.get('join-club-close-btn')?.addEventListener('click', () => toggleModal('join-club-modal', false));
    DOM.get('create-post-btn')?.addEventListener('click', () => toggleModal('post-form-modal', true));
    DOM.get('post-form-create')?.addEventListener('submit', handlePostCreation);
    DOM.get('post-cancel-btn')?.addEventListener('click', () => toggleModal('post-form-modal', false));
    DOM.get('post-form-close-btn')?.addEventListener('click', () => toggleModal('post-form-modal', false));
    DOM.get('edit-message-form')?.addEventListener('submit', handleEditMessage);
    DOM.get('edit-cancel-btn')?.addEventListener('click', () => toggleModal('edit-message-modal', false));
    DOM.get('edit-message-close-btn')?.addEventListener('click', () => toggleModal('edit-message-modal', false));
    DOM.get('edit-profile-form')?.addEventListener('submit', handleProfileUpdate);
    DOM.get('profile-cancel-btn')?.addEventListener('click', () => toggleModal('user-profile-modal', false));
    DOM.get('user-profile-close-btn')?.addEventListener('click', () => toggleModal('user-profile-modal', false));
    // Chat
    DOM.get('chat-form')?.addEventListener('submit', handleSendMessage);
    DOM.get('upload-media-btn')?.addEventListener('click', () => DOM.get('chat-media-input-file')?.click());
    // Club List
    DOM.get('club-list-toggle')?.addEventListener('click', () => {
        const list = DOM.get('club-list');
        const isOpen = list.classList.toggle('show');
        DOM.get('club-list-toggle').setAttribute('aria-expanded', isOpen);
    });
    // Dropdowns
    DOM.get('more-options-btn')?.addEventListener('click', () => {
        const dropdown = DOM.get('more-options-menu');
        const isOpen = dropdown.classList.toggle('active');
        DOM.get('more-options-btn').setAttribute('aria-expanded', isOpen);
    });
    // Event Delegation
    document.addEventListener('click', (e) => {
        const target = e.target;
        // Club Selection
        const clubItem = target.closest('.club-item');
        if (clubItem) {
            selectClub(clubItem.dataset.clubId);
            DOM.get('club-list')?.classList.remove('show');
            DOM.get('club-list-toggle')?.setAttribute('aria-expanded', 'false');
        }
        // Message Menu
        const messageMenu = target.closest('.message-menu');
        if (messageMenu) {
            e.stopPropagation();
            const menuContent = DOM.get(`message-menu-${messageMenu.dataset.messageId}`);
            DOM.queryAll('.message-menu-content.active').forEach(m => {
                if (m !== menuContent) m.classList.remove('active');
            });
            menuContent?.classList.toggle('active');
        }
        // Message Actions
        const messageAction = target.closest('[data-action]');
        if (messageAction && messageAction.closest('.message-menu-content')) {
            const action = messageAction.dataset.action;
            const messageId = messageAction.dataset.messageId;
            if (action === 'editMessage') editMessage(messageId);
            if (action === 'deleteMessage') handleDeleteMessage(messageId);
            if (action === 'pinMessage') pinMessage(messageId);
        }
        // Dropdown Actions
        const dropdownAction = target.closest('[data-action]');
        if (dropdownAction && dropdownAction.closest('#more-options-menu')) {
            const action = dropdownAction.dataset.action;
            if (action === 'addToFavorites') addToFavorites();
            if (action === 'muteClub') muteClub();
            if (action === 'deleteClub') deleteClub(state.currentClubId);
            DOM.get('more-options-menu')?.classList.remove('active');
            DOM.get('more-options-btn')?.setAttribute('aria-expanded', 'false');
        }
        // Topic Selection
        const topicItem = target.closest('.topic-item');
        if (topicItem && !target.classList.contains('remove-topic')) {
            handleTopicSelection(topicItem.dataset.topic);
        }
        const removeTopic = target.closest('.remove-topic');
        if (removeTopic) {
            handleTopicSelection(removeTopic.dataset.topic);
        }
        // Close Dropdowns/Modals
        if (target.closest('.modal-overlay.active')) {
            DOM.queryAll('.modal.active').forEach(modal => toggleModal(modal.id, false));
        }
        if (!target.closest('.message-menu-content') && !target.closest('.message-menu')) {
            DOM.queryAll('.message-menu-content.active').forEach(m => m.classList.remove('active'));
        }
        if (!target.closest('#more-options-menu') && !target.closest('#more-options-btn')) {
            DOM.get('more-options-menu')?.classList.remove('active');
            DOM.get('more-options-btn')?.setAttribute('aria-expanded', 'false');
        }
    });
    // File Previews
    DOM.get('banner-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && validateFile(file, 'image')) {
            readFileAsBase64(file).then(src => {
                if (src) DOM.get('banner-preview-img').src = src;
            });
        }
    });
    DOM.get('image-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && validateFile(file, 'image')) {
            readFileAsBase64(file).then(src => {
                if (src) DOM.get('preview-image-img').src = src;
            });
        }
    });
    // Topic Search
    DOM.get('topic-search-input')?.addEventListener('input', debounce(renderTopicSuggestions, 300));
    // Form Validation
    DOM.queryAll('input, textarea').forEach(input =>
        input.addEventListener('input', () => {
            const errorEl = DOM.get(`${input.id}-error`);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('active');
            }
        })
    );
}

/**
 * Add club to favorites
 */
function addToFavorites() {
    if (!state.currentClubId) return;
    showNotification('Club added to favorites.', 'success');
    // Implement favorite storage logic
}

/**
 * Mute club notifications
 */
function muteClub() {
    if (!state.currentClubId) return;
    showNotification('Club notifications muted.', 'success');
    // Implement mute logic
}

// Initialization
/**
 * Initialize the application
 */
async function init() {
    state.analytics.pageViews++;
    state.isSocketInitialized = initializeSocketIO();
    await safeExecute(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const clubId = urlParams.get('clubId') || state.currentClubId;
        await renderClubList();
        if (clubId) {
            selectClub(clubId);
        } else {
            showNoClubsState();
        }
        renderTopicSuggestions();
    }, 'Failed to initialize page', { silent: true });
    initializeEventListeners();
    enhanceAccessibility();
    preloadImages();
}
init();

// Accessibility Enhancements
/**
 * Enhance accessibility
 */
function enhanceAccessibility() {
    DOM.queryAll('button, input, textarea, select').forEach(el => {
        if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && el.type !== 'hidden') {
            el.setAttribute('aria-label', el.placeholder || el.textContent?.trim() || 'Interactive element');
        }
    });
    DOM.queryAll('.modal').forEach(modal => {
        modal.addEventListener('close', () => {
            DOM.get('create-club-nav-btn')?.focus();
        });
    });
}

// Image Preloading
/**
 * Preload default images
 */
function preloadImages() {
    ['/assets/default-image.jpg', '/assets/default-banner.jpg', '/assets/default-club-image.jpg'].forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// CSS Injection
const style = document.createElement('style');
style.textContent = `
    .modal-overlay.active { animation: fadeIn 0.3s ease; }
    .modal.active { animation: slideUp 0.3s ease; }
    .club-rules { list-style: disc; margin-left: 20px; margin-top: 10px; }
    .chat-message.own { background: var(--accent-color); color: #fff; }
    .chat-message .pinned { font-size: 12px; color: var(--accent-color); }
    .reactions { font-size: 12px; margin-top: 5px; cursor: pointer; }
    .reactions span { margin-right: 8px; }
    .topic-item { padding: 8px; margin: 4px 0; }
    .topic-item .remove-topic { margin-left: 8px; cursor: pointer; }
    @media (prefers-reduced-motion: reduce) {
        .modal, .modal-overlay, .notification { animation: none; }
    }
`;
document.head.appendChild(style);