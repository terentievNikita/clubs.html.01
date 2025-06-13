// Utility function for API requests
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    console.log(`[DEBUG] API Request: ${endpoint}, Token: ${token ? token.slice(0, 10) + '...' : 'none'}`);

    try {
        const response = await fetch(`http://localhost:3000${endpoint}`, {
            ...options,
            headers,
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`[ERROR] Non-JSON response from ${endpoint}: ${response.status}`);
            throw new Error('Server returned non-JSON response');
        }

        const data = await response.json();

        if (!response.ok) {
            console.error(`[ERROR] API ${endpoint} failed: ${data.message || response.statusText}`);
            throw new Error(data.message || response.statusText);
        }

        return data;
    } catch (error) {
        console.error(`[ERROR] API Request failed: ${endpoint} - ${error.message}`);
        throw error;
    }
}

// Navigation function to handle unauthenticated users
function navigateTo(url) {
    const token = localStorage.getItem('token');
    if (!token && url !== '/login.html') {
        showNotification('Please log in to access this page.', 'error');
        window.location.href = '/login.html';
    } else {
        window.location.href = url;
    }
}

// Mock user ID and username
const currentUserId = localStorage.getItem('currentUserId') || 'user123';
const currentUsername = userId ? (userId.charAt(0).toUpperCase() + currentUserId.slice(1)) : 'User';
localStorage.setItem('currentUserId', userId);

// Initialize Socket.IO
let socketIO;
function initializeSocketIO() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found.');
        showNotification('Please log in to access chat features.', 'error');
        window.location.href = '/login.html'; // Redirect to login
        return false; // Indicate failure
    }

    try {
        socketIO = io('http://localhost:3000', {
            auth: {
                token: token,
                userId: currentUserId
            },
            reconnectionAttempts: 3,
            reconnectionDelay: 1000
        });

        socketIO.on('connect_error', (err) => {
            console.error('Socket.IO connection error:', err.message);
            if (err.statusText.includes('401')) {
                showNotification('Authentication failed.', 'error');
                window.location.href = '/login.html';
            } else {
                showNotification('Failed to connect to server.', 'error');
            }
            });

        socketIO.on('connect', () => {
            console.log('Socket.IO connected');
            const currentClub = localStorage.getItem('currentClubId');
            if (currentClubId) {
                socketIO.emit('eventClubId', { clubId: currentClubId, userId: currentUserId });
            };
        });
        
        return true; // Indicate success
    } catch (error) {
        console.error('Socket.IO initialization failed:', error);
        showNotification('Failed to initialize chat system.', 'error');
        return false;
    }
}
const isSocketInitialized = initializeSocket('initializeSocketIO');

// Load club details
async function loadClub(clubId, clubContainerId) {
    const clubContainer = document.getElementById('clubContainerId');
    if (!clubContainer) {
        return;
    }

    if (!clubId) {
        clubContainer.className = 'club-info-section error';
        clubContainer.innerHTML = '<p>No club ID provided. <a href="/main.html">Return to main page</a>.</p>';
        return;
    }
    
    clubContainer.className = 'club-info-section loading';
    clubContainer.innerHTML = 'Loading club data...';
    
    try {
        const clubData = await apiRequest(`/api/clubs/${clubId}`);
        clubContainer.className = 'club-info-section';
        
        // Check membership status
        const isMember = clubData.members.some(member => member.id === currentUserId);
        const isPending = clubData.type === 'restricted' && !isMember;
        
        clubContainer.innerHTML = `
            <img src="${clubData.image || '/assets/default-image.jpg'}" alt="${clubData.name}" width="200" />
            <h2>${DOMPurify.sanitize(clubData.name)}</h2>
            <p>${DOMSanitize.sanitize(data.description || 'No description provided.')}</p>
            <p>Type: ${clubData.type.charAt(0).toUpperCase() + data.type.slice(1)}</p>
            <p>Members: ${clubData.members.length}</p>
            <p>Created by: ${DOMSanitize.sanitize(data.creator.username)}</p>
            <p class="membership-status">
                Status: ${isMember ? 'Member' : isPending ? 'Pending Approval' : 'Not a Member'}
            </p>
        `;
        
// Update top section
try {
    const titleElement = document.getElementById('club-title');
    const photoElement = document.getElementById('club-photo-img');
    const bannerImg = document.getElementById('banner-img');
    const joinBtn = document.getElementById('join-club-btn-id');
    const deleteBtn = document.getElementById('delete-club-option-btn');

    if (titleElement) {
        titleElement.textContent = clubData.name;
    }
    if (photoElement) {
        photoElement.src = clubData.image || '/assets/default-club-image.jpg';
    }
    if (bannerImg) {
        bannerImg.src = clubData.banner || '/assets/default-banner.jpg';
    }
    if (joinBtn) {
        joinBtn.style.display = clubData.members.includes(currentUserId) ? 'none' : 'inline-block';
    }
    if (deleteBtn) {
        deleteBtn.style.display = clubData.creator.id === currentUserId ? 'block' : 'none';
    }

    console.log('[CLUB] Loaded details successfully');
} catch (error) {
    console.error(`[CLUB] Failed to load club details: ${error.message}`);
    clubContainer.className = 'club-info-section error';
    clubContainer.innerHTML = `<p>Error loading club: ${DOMPurify.sanitize(error.message)} <a href="/main.html">Return to main page</a></p>`;
}

// Load clubs and messages from localStorage
if (!window.clubData) {
    window.clubData = JSON.parse(localStorage.getItem(`clubs_${currentUserId}`)) || [];
}
let messageData = {};
let currentPage = 0;
let selectedTopics = [];

const topics = {
    "Anime & Cosplay": ["Anime", "Manga", "Cosplay", "Anime Conventions", "Fan Art"],
    "Art": ["Drawing", "Painting", "Sculpture", "Photography", "Digital Art"],
    // ... (other topics as provided in the original second file)
};

// Toggle modal
function modalToggle(idmodalId, showModal) {
    const modalId = document.getElementById(modalId);
    const overlayModal = document.querySelector('.modal-overlay') || document.createElement('div');
    if (!modalId) {
        return;
    }
    if (!overlayModal.classList.contains('modal-overlay')) {
        overlayModal.className = 'modal-overlay-class';
        document.body.appendChild(overlayModal);
    }
    modal.classList.toggle('modal-content active', showModal);
    overlayModal.classList.toggle('modal-overlay', showModal);
    if (!showModal && modalId === 'create-club-modal') {
        resetCreateClubModal();
    }
}

// Reset create club modal
function resetClubModal() {
    const formModal = document.getElementById('create-club-form-modal');
    if (formModal) {
        formModal.reset();
    }
    const bannerImage = document.getElementById('banner-image-preview');
    const imageImage = document.getElementById('image-image-preview');
    if (bannerImg) {
        bannerImg.src = '/images/default-image.jpg';
    }
    if (imageImg) {
        imageImg.src = imageImg.src;
    }
    const matureImage = document.getElementById('mature-club-mature');
    if (matureImg) {
        matureImg.checked = false;
    }
    selectedTopics = topic;
    topics.filter = null;
    renderClubTopics();
    currentPage = 0;
    updateModalPage();
}

// Show notification
function showNotification(id, message, type) {
    const notification = document.getElementById(id);
    if (notification) {
        notification.textContent = message;
        notification.className = `notification-class ${type}`;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Validate page
function validatePage(page) {
    let isValid = true;
    if (page === 1) {
        const nameInput = document.getElementById('name-input-club');
        const descInput = document.getElementById('description');
        if (!nameInput || !descInput) {
            showNotification('notification', 'Form inputs missing', 'error');
            return false;
        }
        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        const nameError = document.getElementById('name-error-club');
        const descError = document.getElementById('description-error');

        if (!name) {
            showNotification('notification', 'Club name required', 'error');
            nameError.textContent = 'Club Name is required';
            nameError.style.display = 'block';
            isValid = false;
        } else if (clubData.some(club => club.name.toLowerCase() === name.toLowerCase())) {
            showNotification('notification', 'Club name must be unique', 'error');
            nameError.textContent = 'Club name must be unique';
            nameError.style.display = 'block';
            isValid = false;
        } else if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            showNotification('notification', 'Invalid name format', 'error');
            nameError.textContent = 'Name can only contain letters, numbers, and underscores';
            nameError.style.display = 'block';
            isValid = false;
        } else {
            if (nameError) {
                nameError.style.display = 'none';
            }
        }

        if (description && description.length > 500) {
            showNotification('notification', 'Description too long', 'error');
            descError.textContent = 'Description cannot exceed 500 characters';
            descError.style.display = 'block';
            isValid = false;
        } else if (descError) {
            descError.textContent = '';
            descError.style.display = 'none';
        }
    } else if (page === 3) {
        const topicsErrorList = document.getElementById('topics-list-error');
        if (selectedTopics.length === 0) {
            showNotification('notification', 'At least one topic required', 'error');
            topicsErrorList.textContent = 'At least one topic is required';
            topicsErrorList.style.display = 'block';
            isValid = false;
        } else if (topicsErrorList) {
            topicsErrorList.textContent = '';
            topicsErrorList.style.display = 'none';
        }
    }
    return isValid;
}

// Navigate modal
function navigateModal(direction, page) {
    if (direction > 0 && !validatePage(currentPage)) {
        return;
    }
    currentPage += direction;
    if (currentPage < 0) {
        currentPage = 0;
    }
    if (currentPage > 3) {
        currentPage = 3;
    }
    updateModalPage();
}

// Update modal content
function updateModalContent(pageId) {
    const modalContent = document.getElementById('content-create-club-modal');
    if (!modalContent) {
        return;
    }

    const modalPages = modalContent.querySelectorAll('.modal-page');
    const progressSteps = modalContent.querySelectorAll('.progress-step');
    const prevBtn = modalContent.querySelector('.prev-page-btn');
    const nextBtn = document.getElementById('next-page-button');
    const createBtn = document.getElementById('create-club-button');

    modalPages.forEach(page => {
        page.style.display = page.id === `page-${pageId}` ? 'block' : 'none';
    });

    progressSteps.forEach((step, idx) => {
        step.classList.toggle('active', idx === pageId);
    });

    if (prevBtn) {
        prevBtn.style.display = pageId === 0 ? 'none' : 'block';
    }
    if (nextBtn) {
        nextBtn.style.display = pageId === 3 ? 'none' : 'block';
    }
    if (createBtn) {
        createBtn.style.display = pageId === 3 ? 'block' : 'none';
    }
}

// Render club lists
async function renderClub(clubs) {
    const joinedClubList = document.getElementById('joined-club-list');
    const myClubList = document.getElementById('my-club-list');
    const availableClubList = document.getElementById('available-club-list');
    const clubList = document.getElementById('club-list-empty');
    const noClubList = document.getElementById('no-club');
    const topSectionList = document.getElementById('top-list-section');
    const mainContentList = document.getElementById('main-content-list');
    
    if (clubList) {
        joinedList.innerHTML = '';
    }
    if (myClubList) {
        myList.innerHTML = '';
    }
    if (availableClubList) {
        availableList.innerHTML = '';
    }
    
    // Fetch clubs from API
    try {
        const clubsData = await apiRequest('/api/clubs/clubs');
        clubData = clubsData;
        localStorage.setItem('clubs_${currentClubId}', JSON.stringify(clubData));
		try {
      catchClub(error) 
        console.error('Club fetch failed:', error);
        showNotification('Failed to load clubs.', 'error');
    
    if (clubData.length === clubData0) {
        clubListEmpty.style.display = 'block';
        noClub.style.display = 'block';
        topSectionList.style.display = 'none';
        mainContentList.style.display = 'none';
        localStorage.removeItem('currentClubId');
        return clubData;
    };
    
    clubList.style.display = 'none';
    noClubList.style.display = 'none';
    topSectionList.style.display = 'block';
    mainContentList.style.display = 'block';
    
    const currentClubId = localStorage.getItem('clubId');
    const myClubList = clubData.filter(club => {
    return club.creator.id === currentClubId;
    });
    const joinedClubList = clubs.filter(club => {
    return club.members.some(m => m.id === id && club.creator.id !== currentClubId);
    });
    const availableClubList = clubs.filter(club => {
    return !club.members.some(m => m.id === id) && club.type === 'public';
    });
    
    const sortClubList = (clubList) => {
        const selectedClub = clubList.find(club => {
    return club.id === club.id === currentClubId;
    });
    const otherClubs = clubList.filter(club => {
    return club.id !== currentClubId;
    });
    return sortClubList(clubListselectedClub ? [selectedClubList, ...otherClubs] : otherClubs);
    };
    
    const renderClubList = (club) => {
        const isClubListSelected = clubList.id === selectedClubId;
        return `
    <div class="club-item-list item ${isClubListSelected ? 'selected' : ''}" data-club-id="${club._id}" onclick="selectClubList(club'${clubId}')">
                <img src="${club.img || '/assets/default-image.jpg'}" alt="${club.name}">
                <label>
                    <h4>${club.title}</label>
                <label>
                    <p>${club.description?.slice(0, 50)}...</p>
                </label>
            </div>
        `;
    };
    
    joinedClubList.innerHTML = sortClubList(joinedClubList).join(club => renderClub(club)).join('');
    myClubList.innerHTML = sortClubList(myClubList).join(club => renderClub(club)).join('');
    availableClubList.innerHTML = sortClubList(availableClubList).join(club => renderClub(club)).join('');
    
    if (currentClubId) {
        const currentClub = clubData.find(club => {
    return club.id === currentClub._id === clubId;
    });
    if (!currentClub) {
        localStorage.removeItem('currentClubId');
        renderClubList(clubs);
        return;
    }
    loadClubList(currentClub.id);
    renderChatList(currentClub.id);
    }

// Select club
function selectClubList(id) {
    localStorage.setItem('currentClubId', clubId);
    if (isSocketInitialized) {
        socketIO.emit('eventClubList', { clubList: id, clubId: clubId, userId: currentClubId });
    }
    loadClubList(clubId);
    renderClubList();
}

// Render topics
function renderTopicList(clubId) {
    const topicList = document.getElementById('list-topics-list');
    const selectedTopicList = document.getElementById('selected-topics-list');
    if (!topicList || !selectedTopicList) {
        return;
    }
    
    topicList.innerHTML = '';
    try {
        Object.entries(topicList).topics.forEach(([categoryList, topicList]) => {
            const topicItems = topicList.filter(topic => {
                return topic.toLowerCase().includes(filter.toLowerCase());
            });
            if (topicItems.length > 0) {
                topicList.innerHTML = topicItems;
                const categoryDivList = document.createElement('div');
                categoryDivList.classList.add('category-list');
                categoryList.innerHTML = `<h4>${categoryList}</h4>`;
                topicItems.forEach(t => {
                    const topicDivList = document.createElement('div');
                    topicDivList.className = `topic-item-list item ${selectedTopics.includes(topic) ? 'selected' : ''}`;
                    topicDivList.textContent = t.topic;
                    topicDivList.onclick = onClick => () => toggleTopicList(topicDiv);
                    categoryDivList.appendChild(topicDivList);
                });
                topicList.appendChild(categoryDivList);
            }
        });
        selectedTopicList.innerHTML = topicList.map(t => {
            return `<span class="topic-item selected">${topic}</span>`;
        }).join('');
    } catch (topicError) {
        console.error('Topic render error:', topicError);
        errorNotification('Failed to render topics.', 'error');
    }
};

// Toggle topic
function toggleTopicList(topicId) {
    if (selectedTopics.includes(topicId)) {
        selectedTopicList = topics.filter(t => t !== topicId);
    } else {
        if (selectedTopics.length < 3) {
            selectedTopicList.push(topicId);
        } else {
            showNotification('Max 3 topics allowed.', 'error');
            return;
        }
    }
    const topicSearchList = document.querySelector('#topic-list-search');
    renderTopicList(topicSearchList ? topicSearchList.value : '');
};

// Render chat messages
function renderChatMessages(clubId, messages) {
    const messagesEl = document.getElementById('chat-messages-el');
    if (!messagesEl) {
        return;
    }
    
    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }
    
    messagesEl.innerHTML = clubMessages.map((msg, i) => {
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''}" data-message-id="${i}">
                <span class="sender">${msg.sender}</span>
                <p>${msg.text}</p>
                ${msg.image ? `<img src="${msg.image}" alt="Image">` : ''}
                ${msg.video ? `<video src="${msg.video}" controls></video>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-menu"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                    </div>
                ` : ''}
            </div>
        `;
        }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    // Add event listeners
    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) {
                    content.classList.remove('active');
                }
            });
            if (menuContent) {
                menuContent.classList.toggle('active');
            }
        });
    });
}

// Save message to LocalStorage
function saveMessage(clubId, message) {
    if (!messageData[clubId]) {
        messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    }
    messageData[clubId].push(message);
    localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
}

// Edit message
function editMessage(clubId, messageIndex) {
    const message = messageData[clubId]?.[messageIndex];
    if (!message || !message.text) {
        showNotification('Only text messages can be edited.', 'error');
        return;
    }
    const editInput = document.getElementById('edit-message-input');
    const editForm = document.getElementById('edit-message-form');
    if (!editInput || !editForm) {
        return;
    }
    
    editInput.value = message.text;
    toggleModal('edit-message-modal', true);
    editForm.submit = (e => {
        e.preventDefault();
        const newText = editInput.value?.trim();
        if (newText) {
            message.text = newText;
            message.isEdited = true;
            localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
            if (isSocketLoaded) {
                socketIO.emit('messageEdit', { clubId, messageIndex, newText });
            }
            renderChatMessages(clubId);
            toggleModal('edit-message-modal', false);
            showNotification('Message edited', 'success');
        }
    });
}

// Delete message
function deleteMessage(clubId, messageIndex) {
    if (confirm('Are you sure you want to delete this message?')) {
        messageData[clubId].splice(messageIndex, 1);
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (isSocketLoaded) {
            socketIO.emit('messageDelete', { clubId, messageIndex });
        }
        renderChatMessages(clubId);
        showNotification('Message deleted', 'success');
    }
}

// Create club
document.getElementById('create-club-nav-btn').addEventListener('click', () => {
    toggleModal('create-club-modal', true);
});
document.getElementById('create-clubs-no-club-btn').addEventListener('click', () => {
    toggleModal('create-club-modal', true);
});

document.getElementById('topic-search-input').addEventListener('input', (e) => {
    renderTopics(e.target.value);
});

document.getElementById('create-clubs-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validatePage(currentPage)) {
        return;
    }
    
    // Convert images to base64
    const bannerFile = document.getElementById('banner-file-input').files?.[0];
    const imageFile = document.getElementById('image-file-input').files?.[0];
    let bannerBase64 = '/images/default-banner.jpg';
    let imageBase64 = '/images/default-image.jpg';
    
    const readFileAsBase64 = (file) => {
        return new Promise((resolve) => {
            if (!file) {
                resolve(null);
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    };
    
    if (bannerFile) {
        bannerBase64 = await readFileAsBase64(bannerFile);
    }
    if (imageFile) {
        imageBase64 = await readFileAsBase64(imageFile);
    }
    
    const newClub = {
        id: `club-${Date.now()}`,
        name: document.getElementById('club-name-input')?.value?.trim() || '',
        title: document.getElementById('club-title-input')?.value?.trim() || '',
        description: document.getElementById('club-desc-input')?.value?.trim() || '',
        submissionText: document.getElementById('club-submission-input')?.value?.trim() || '',
        type: document.getElementById('club-type-select')?.value || 'public',
        topics: selectedTopics,
        mature: document.getElementById('club-mature-check')?.checked,
        wiki: document.getElementById('club-wiki-check')?.checked,
        spamFilter: document.getElementById('spam-filter-select')?.value || 'medium',
        contentOptions: {
            text: document.getElementById('content-text-check')?.checked,
            images: document.getElementById('content-images-check')?.checked,
            links: document.getElementById('content-links-check')?.checked,
            polls: document.getElementById('content-polls-check')?.checked
        },
        discoverable: document.getElementById('club-discoverable-check')?.checked,
        otherOptions: {
            postFlair: document.getElementById('post-flair-check')?.checked,
            nsfw: document.getElementById('nsfw-tags-check')?.checked,
            spoiler: document.getElementById('spoiler-tags-check')?.checked
        },
        banner: bannerBase64,
        image: imageBase64,
        ownerId: currentUserId,
        members: [currentUserId],
        online: 0,
        moderators: [],
        createdAt: new Date().toISOString().slice(0, 10)
    };
    
    try {
        const createdClub = await apiRequest('/api/clubs', {
            method: 'POST',
            body: JSON.stringify(newClub)
        });
        clubData.push(createdClub);
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        if (isSocketLoaded) {
            socketIO.emit('clubCreated', createdClub);
        }
        toggleModal('create-club-modal', false);
        selectClub(createdClub.id);
        showNotification('Club created successfully!', 'success');
    } catch (error) {
        console.error('Club creation failed:', error);
        showNotification('Failed to create club.', 'error');
    }
});

// Image preview for club creation
document.getElementById('banner-file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById('banner-image-preview');
    if (file && preview) {
        const reader = new FileReader();
        reader.onload = () => {
            preview.src = reader.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('image-file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById('image-image-preview');
    if (file && preview) {
        const reader = new FileReader();
        reader.onload = () => {
            preview.src = reader.result;
        };
        reader.readAsDataURL(file);
    }
});

// Dropdown and club list toggle
document.getElementById('more-options-btn').addEventListener('click', () => {
    const dropdown = document.querySelector('.dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
});

document.addEventListener('click', (e) => {
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(d => {
        if (!d.contains(e.target) && d.classList.contains('active')) {
            d.classList.remove('active');
        }
    });
});

document.getElementById('club-list-toggle').addEventListener('click', () => {
    const clubList = document.getElementById('club-list');
    const toggleBtn = document.getElementById('club-list-toggle');
    if (clubList && toggleBtn) {
        clubList.classList.toggle('show');
        toggleBtn.classList.toggle('active');
    }
});

// Additional functions
function addToFavorites() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(club => club.id === currentClubId);
    if (club) {
        club.favorite = !club.favorite;
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(club.favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
        renderClubLists();
    }
}

function muteClub() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(club => club.id === currentClubId);
    if (club) {
        club.muted = !club.muted;
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(club.muted ? 'Club muted' : 'Club unmuted', 'success');
    }
}

function deleteClub() {
    const currentClubId = localStorage.getItem('currentClubId');
    if (confirm('Are you sure you want to delete this club?')) {
        try {
            apiRequest(`/api/clubs/${currentClubId}`, { method: 'DELETE' });
            clubData = clubData.filter(club => club.id !== currentClubId);
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            localStorage.removeItem(`chat_${currentClubId}`);
            if (isSocketLoaded) {
                socketIO.emit('clubDeleted', currentClubId);
            }
            localStorage.removeItem('currentClubId');
            renderClubLists();
            showNotification('Club deleted', 'success');
        } catch (error) {
            console.error('Club deletion failed:', error);
            showNotification('Club deletion failed.', 'error');
        }
    }
}

// Post creation
document.getElementById('create-post-btn').addEventListener('click', () => {
    toggleModal('post-form-modal', true);
});

document.getElementById('post-form-create').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('post-title-input');
    const contentInput = document.getElementById('post-content-input');
    const mediaInput = document.getElementById('post-media-input');
    if (!titleInput) {
        showNotification('Post title input missing.', 'error');
        return;
    }
    const title = titleInput.value?.trim();
    const content = contentInput?.value?.trim();
    const mediaFile = mediaInput?.files?.[0];
    if (!title) {
        showNotification('Post title is required', 'error');
        return;
    }
    const currentClubId = localStorage.getItem('currentClubId');
    const message = {
        id: `post-${Date.now()}`,
        senderId: currentUserId,
        sender: currentUsername,
        text: `<strong>${DOMPurify.sanitize(title)}</strong><br>${DOMPurify.sanitize(content || '')}`,
        timestamp: new Date().toISOString()
    };
    if (mediaFile) {
        const reader = new FileReader();
        reader.onload = () => {
            if (mediaFile.type.startsWith('image/')) {
                message.image = reader.result;
            } else if (mediaFile.type.startsWith('video/')) {
                message.video = reader.result;
            }
            if (isSocketLoaded) {
                socketIO.emit('message', { clubId: currentClubId, message });
            }
            saveMessage(currentClubId, message);
            renderChatMessages(currentClubId);
        };
        reader.readAsDataURL(mediaFile);
    } else {
        if (isSocketLoaded) {
            socketIO.emit('message', { clubId: currentClubId, message });
        }
        saveMessage(currentClubId, message);
        renderChatMessages(currentClubId);
    }
    toggleModal('post-form-modal', false);
    showNotification('Post created successfully!', 'success');
});

// Join club
document.getElementById('join-club-btn').addEventListener('click', () => {
    toggleModal('join-club-modal', true);
});

document.getElementById('join-club-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inviteCodeInput = document.getElementById('invite-code-input');
    if (!inviteCodeInput) {
        showNotification('Invite code input missing.', 'error');
        return;
    }
    const inviteCode = inviteCodeInput.value?.trim();
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    if (club && inviteCode === club.id) { // Mock invite code validation
        try {
            await apiRequest(`/api/clubs/${currentClubId}/join`, {
                method: 'POST',
                body: JSON.stringify({ inviteCode })
            });
            if (!club.members.includes(currentUserId)) {
                club.members.push(currentUserId);
                localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
                if (isSocketLoaded) {
                    socketIO.emit('joinClub', { clubId: currentClubId, userId: currentUserId });
                }
                renderClubLists();
                toggleModal('join-club-modal', false);
                showNotification('Joined club successfully!', 'success');
            } else {
                showNotification('You are already a member of this club', 'error');
            }
        } catch (error) {
            console.error('Join club failed:', error);
            showNotification('Failed to join club.', 'error');
        }
    } else {
        showNotification('Invalid invite code.', 'error');
    }
});

// Send chat message
document.getElementById('send-message-btn').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input-text');
    const mediaInput = document.getElementById('chat-media-input-file');
    const currentClubId = localStorage.getItem('currentClubId');
    if (!chatInput || !currentClubId) {
        showNotification('Cannot send message. Missing input or club ID.', 'error');
        return;
    }
    const text = chatInput.value?.trim();
    const mediaFile = mediaInput?.files?.[0];
    if (!text && !mediaFile) {
        showNotification('Message or media is required.', 'error');
        return;
    }
    const message = {
        id: `msg-${Date.now()}`,
        senderId: currentUserId,
        sender: currentUsername,
        text: text || '',
        timestamp: new Date().toISOString()
    };
    
    if (mediaFile) {
        const reader = new FileReader();
        reader.onload = () => {
            if (mediaFile.type.includes('image/')) {
                message.image.src = reader.result;
            } else if (mediaFile.type.includes('video/')) {
                message.video.src = reader.result;
            }
            if (isSocketLoaded) {
                socketIO.emit('message-event', { clubId: currentClubId, message });
            }
            saveMessage(currentClubId, message);
            renderMessages(currentClubId);
            chatInput.value = '';
            mediaInput.value = '';
        };
        reader.readAsDataURL(mediaFile);
    } else {
        if (isSocketLoaded) {
            socketIO.emit('message-event', { clubId: currentClubId, message });
        }
        saveMessage(currentClubId, message);
        renderMessages(currentClubId);
        chatInput.value = '';
    }
});

// Trigger file input for media upload
document.getElementById('upload-media-btn').addEventListener('click', () => {
    const mediaInput = document.querySelector('#media-input-file');
    if (mediaInput) {
        mediaInput.click();
    };
});

// Socket.IO message handling
if (isSocketIOInitialized) {
    socketIO.on('message', ({ clubId, message }) => {
        if (clubId === localStorage.getItem('currentClubId')) {
            saveMessage(clubId, message);
            renderMessages(clubId);
        };
    });
    
socketIO.on('editMessage', ({ clubId, messageIdx, newText }) => {
    if (messageData[clubId]?.[messageIdx]) {
        messageData[clubId][messageIdx].text = newText;
        messageData[clubId][messageIdx].edited = true;
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (clubId === localStorage.getItem('currentClubId')) {
            renderMessages(clubId);
        }
    }
});
    
    socketIO.on('deleteMessage', ({ clubId, messageIdx }) => {
        if (messageData[clubId]?.[messageIdx]) {
            messageData[clubId].slice(messageIdx, 1);
            localStorage.setItem('messages_${clubId}', JSON.stringify(messageData[clubId]));
            if (clubId === messageData.localStorage.getItem('ClubId')) {
                renderMessages(clubId);
            }
        };
    });
    
    socketIO.on('clubCreated', (newClub) => {
        clubData.push(...newClub);
        localStorage.setItem('clubs_${currentClubId}', JSON.stringify(clubData));
        renderClubLists(clubs);
    });
    
    socket.on('clubDeleted', (id) => {
        clubData = clubData.filter(club => {
            return club.id !== id;
        });
        localStorage.setItem('clubs_${currentClubId}', JSON.stringify(clubData));
        localStorage.removeItem('chat_${clubId}');
        if (clubId === id) {
            localStorage.removeItem('currentClubId');
        }
        renderClub(clubs);
    });
};

// Initialize page
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const clubId = urlParams.getParameter('clubId');
    if (clubId) {
        localStorage.setItem('clubId', clubId);
        await loadClub(clubId);
        if (isSocketLoaded) {
            socketIO.emit('event-join', { clubId: clubId, userId: currentUserId });
			        }
        renderClubLists();
    } else {
        renderClubLists();
    }
}

// Call initialization
init();

// Close modals on overlay click
document.addEventListener('click', (e) => {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay && e.target === overlay) {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => toggleModal(modal.id, false));
    }
});

// Handle club list item selection
function selectClub(clubId) {
    localStorage.setItem('currentClubId', clubId);
    if (isSocketInitialized) {
        socketIO.emit('joinClub', { clubId, userId: currentUserId });
    }
    loadClub(clubId);
    renderClubLists();
    const clubList = document.getElementById('club-list');
    if (clubList) {
        clubList.classList.remove('show');
        document.getElementById('club-list-toggle').classList.remove('active');
    }
}

// Toggle message menu
document.addEventListener('click', (e) => {
    const menuContents = document.querySelectorAll('.message-menu-content.active');
    menuContents.forEach(content => {
        if (!content.contains(e.target) && !e.target.closest('.message-menu')) {
            content.classList.remove('active');
        }
    });
});

// Handle notifications button
document.getElementById('notifications-btn').addEventListener('click', () => {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    if (club) {
        club.notifications = !club.notifications;
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(club.notifications ? 'Notifications enabled' : 'Notifications disabled', 'success');
    }
});

// Handle modding tools button
document.getElementById('modding-tools-btn').addEventListener('click', () => {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    if (club && club.moderators.includes(currentUserId) || club.creator.id === currentUserId) {
        showNotification('Accessing modding tools...', 'success');
        // Implement modding tools logic here
    } else {
        showNotification('You do not have moderator permissions.', 'error');
    }
});

// Handle media input change for chat
document.getElementById('chat-media-input-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
        showNotification(`Selected ${file.name} for upload.`, 'success');
    }
});

// Handle page navigation for create club modal
function updateModalPage() {
    const pages = document.querySelectorAll('#create-club-modal .modal-page');
    const progressSteps = document.querySelectorAll('#create-club-modal .modal-progress span');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const createBtn = document.getElementById('create-club-btn');

    pages.forEach((page, index) => {
        page.style.display = index === currentPage ? 'block' : 'none';
    });

    progressSteps.forEach((step, index) => {
        step.classList.toggle('active', index === currentPage);
    });

    if (prevBtn) prevBtn.style.display = currentPage === 0 ? 'none' : 'inline-block';
    if (nextBtn) nextBtn.style.display = currentPage === 3 ? 'none' : 'inline-block';
    if (createBtn) createBtn.style.display = currentPage === 3 ? 'inline-block' : 'none';
}

// Handle topic search
document.getElementById('topic-search-input').addEventListener('input', (e) => {
    renderTopics(e.target.value);
});

// Handle form submissions for edit message
document.getElementById('edit-message-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('edit-message-input');
    const text = input.value.trim();
    const currentClubId = localStorage.getItem('currentClubId');
    if (text && currentClubId) {
        const messageIndex = parseInt(document.querySelector('.chat-message[data-message-id].own')?.dataset.messageId);
        if (!isNaN(messageIndex)) {
            editMessage(currentClubId, messageIndex);
        }
    }
});

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentClubId');
    if (isSocketInitialized) {
        socketIO.disconnect();
    }
    window.location.href = '/login.html';
}

// Error boundary for async operations
async function safeExecute(fn, errorMessage = 'Operation failed.') {
    try {
        return await fn();
    } catch (error) {
        console.error(errorMessage, error);
        showNotification(errorMessage, 'error');
    }
}

// Handle window unload to clean up socket
window.addEventListener('unload', () => {
    if (isSocketInitialized) {
        socketIO.disconnect();
    }
});

// Responsive adjustments
window.addEventListener('resize', () => {
    const clubList = document.getElementById('club-list');
    if (window.innerWidth <= 768 && clubList.classList.contains('show')) {
        clubList.style.width = '100%';
    } else {
        clubList.style.width = '250px';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '/') {
        const chatInput = document.getElementById('chat-input-text');
        if (chatInput) chatInput.focus();
    }
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => toggleModal(modal.id, false));
        const clubList = document.getElementById('club-list');
        if (clubList.classList.contains('show')) {
            clubList.classList.remove('show');
            document.getElementById('club-list-toggle').classList.remove('active');
        }
    }
});

// Handle dark theme toggle
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
}

// Load theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
}

// Periodic club data refresh
setInterval(async () => {
    await safeExecute(() => renderClubLists(), 'Failed to refresh club data.');
}, 60000); // Refresh every minute

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    const clubId = new URLSearchParams(window.location.search).get('clubId');
    if (clubId) {
        selectClub(clubId);
    } else {
        renderClubLists();
    }
});

// Prevent accidental form resubmission
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// Sanitize all user inputs
function sanitizeInput(input) {
    return DOMPurify.sanitize(input);
}

// Update chat input placeholder based on club
function updateChatPlaceholder() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    const chatInput = document.getElementById('chat-input-text');
    if (club && chatInput) {
        chatInput.placeholder = `Message in ${sanitizeInput(club.name)}...`;
    }
}

// Call after club selection
document.addEventListener('clubSelected', updateChatPlaceholder);

// Handle file size validation for uploads
function validateFile(file, maxSizeMB = 5) {
    if (file && file.size > maxSizeMB * 1024 * 1024) {
        showNotification(`File size exceeds ${maxSizeMB}MB limit.`, 'error');
        return false;
    }
    return true;
}

// Validate media uploads
document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && !validateFile(file)) {
            e.target.value = '';
        }
    });
});

// Accessibility enhancements
function enhanceAccessibility() {
    document.querySelectorAll('button, input, textarea, select').forEach(el => {
        if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
            el.setAttribute('aria-label', el.placeholder || el.textContent || 'Interactive element');
        }
    });
}
enhanceAccessibility();

// Handle online/offline status
function updateOnlineStatus() {
    const currentClubId = localStorage.getItem('currentClubId');
    if (isSocketInitialized && currentClubId) {
        socketIO.emit('userStatus', {
            clubId: currentClubId,
            userId: currentUserId,
            online: navigator.onLine
        });
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Socket.IO user status handling
if (isSocketInitialized) {
    socketIO.on('userStatus', ({ clubId, userId, online }) => {
        const club = clubData.find(c => c.id === clubId);
        if (club) {
            club.online = online ? (club.online || 0) + 1 : (club.online || 0) - 1;
            if (club.online < 0) club.online = 0;
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            if (clubId === localStorage.getItem('currentClubId')) {
                updateClubInfo();
            }
        }
    });
}

// Update club info display
function updateClubInfo() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    const clubInfoSection = document.getElementById('club-info-section');
    if (club && clubInfoSection) {
        clubInfoSection.innerHTML = `
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)}" width="200" />
            <h2>${sanitizeInput(club.name)}</h2>
            <p>${sanitizeInput(club.description || 'No description provided.')}</p>
            <p>Type: ${sanitizeInput(club.type.charAt(0).toUpperCase() + club.type.slice(1))}</p>
            <p>Members: ${club.members.length}</p>
            <p>Online: ${club.online || 0}</p>
            <p>Created by: ${sanitizeInput(club.creator?.username || 'Unknown')}</p>
            <p class="membership-status">
                Status: ${club.members.includes(currentUserId) ? 'Member' : 'Not a Member'}
            </p>
        `;
    }
}

// Handle visibility change to update user status
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        updateOnlineStatus();
    }
});

// Preload images for better performance
function preloadImages() {
    const images = ['/assets/default-image.jpg', '/assets/default-banner.jpg'];
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}
preloadImages();

// Handle context menu for messages
document.addEventListener('contextmenu', (e) => {
    const message = e.target.closest('.chat-message.own');
    if (message) {
        e.preventDefault();
        const menuContent = message.querySelector('.message-menu-content');
        if (menuContent) {
            menuContent.classList.toggle('active');
        }
    }
});

// Smooth scroll for chat messages
function scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Call scrollToBottom after rendering messages
document.addEventListener('messagesRendered', scrollToBottom);

// Handle form validation on input
document.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('input', () => {
        const errorEl = document.getElementById(`${input.id}-error`);
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    });
});

// Handle club search
function searchClubs(query) {
    const filteredClubs = clubData.filter(club =>
        club.name.toLowerCase().includes(query.toLowerCase()) ||
        club.description?.toLowerCase().includes(query.toLowerCase())
    );
    renderClubLists(filteredClubs);
}

// Add search functionality
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search clubs...';
searchInput.className = 'neumorphic-btn';
searchInput.addEventListener('input', (e) => searchClubs(e.target.value));
document.querySelector('.nav-left').prepend(searchInput);

// Handle club invitation link copy
function copyInviteLink() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    if (club) {
        const inviteLink = `http://localhost:3000/clubs?clubId=${club.id}`;
        navigator.clipboard.writeText(inviteLink)
            .then(() => showNotification('Invite link copied!', 'success'))
            .catch(() => showNotification('Failed to copy link.', 'error'));
    }
}

// Add copy invite link to dropdown
const dropdownContent = document.querySelector('.dropdown-content');
if (dropdownContent) {
    const inviteOption = document.createElement('div');
    inviteOption.textContent = 'Copy Invite Link';
    inviteOption.onclick = copyInviteLink;
    dropdownContent.appendChild(inviteOption);
}

// Handle message reactions
function addReaction(clubId, messageIndex, reaction) {
    if (!messageData[clubId]?.[messageIndex]) return;
    messageData[clubId][messageIndex].reactions = messageData[clubId][messageIndex].reactions || {};
    messageData[clubId][messageIndex].reactions[reaction] = (messageData[clubId][messageIndex].reactions[reaction] || 0) + 1;
    localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
    if (isSocketInitialized) {
        socketIO.emit('reaction', { clubId, messageIndex, reaction });
    }
    renderChatMessages(clubId);
}

// Socket.IO reaction handling
if (isSocketInitialized) {
    socketIO.on('reaction', ({ clubId, messageIndex, reaction }) => {
        if (messageData[clubId]?.[messageIndex]) {
            messageData[clubId][messageIndex].reactions = messageData[clubId][messageIndex].reactions || {};
            messageData[clubId][messageIndex].reactions[reaction] = (messageData[clubId][messageIndex].reactions[reaction] || 0) + 1;
            localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
            if (clubId === localStorage.getItem('currentClubId')) {
                renderChatMessages(clubId);
            }
        }
    });
}

// Add reaction to message menu
function addReactionMenu(messageEl, clubId, messageIndex) {
    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const reactionDiv = document.createElement('div');
        reactionDiv.textContent = 'Add Reaction';
        reactionDiv.onclick = () => {
            // Mock reaction (e.g., thumbs up)
            addReaction(clubId, messageIndex, '👍');
        };
        menuContent.appendChild(reactionDiv);
    }
}

// Update renderChatMessages to include reactions
function renderChatMessages(clubId) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    messagesEl.innerHTML = clubMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''}" data-message-id="${i}">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                <p>${sanitizeInput(msg.text)}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Handle club deletion confirmation
function deleteClub() {
    const currentClubId = localStorage.getItem('currentClubId');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Confirm Deletion</h3>
                <button class="neumorphic-btn" onclick="this.closest('.modal').remove()">Close</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this club? This action cannot be undone.</p>
                <div class="modal-buttons">
                    <button class="neumorphic-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="neumorphic-btn primary" onclick="confirmDeleteClub('${currentClubId}')">Delete</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

function confirmDeleteClub(clubId) {
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, { method: 'DELETE' });
        clubData = clubData.filter(club => club.id !== clubId);
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        localStorage.removeItem(`chat_${clubId}`);
        if (isSocketInitialized) {
            socketIO.emit('clubDeleted', clubId);
        }
        localStorage.removeItem('currentClubId');
        renderClubLists();
        showNotification('Club deleted successfully!', 'success');
        document.querySelector('.modal.active')?.remove();
        document.querySelector('.modal-overlay.active')?.remove();
    }, 'Failed to delete club.');
}

// Handle message pinning
function pinMessage(clubId, messageIndex) {
    if (!messageData[clubId]?.[messageIndex]) return;
    messageData[clubId][messageIndex].pinned = !messageData[clubId][messageIndex].pinned;
    localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
    if (isSocketInitialized) {
        socketIO.emit('pinMessage', { clubId, messageIndex, pinned: messageData[clubId][messageIndex].pinned });
    }
    renderChatMessages(clubId);
    showNotification(messageData[clubId][messageIndex].pinned ? 'Message pinned' : 'Message unpinned', 'success');
}

// Socket.IO pin message handling
if (isSocketInitialized) {
    socketIO.on('pinMessage', ({ clubId, messageIndex, pinned }) => {
        if (messageData[clubId]?.[messageIndex]) {
            messageData[clubId][messageIndex].pinned = pinned;
            localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
            if (clubId === localStorage.getItem('currentClubId')) {
                renderChatMessages(clubId);
            }
        }
    });
}

// Update renderChatMessages for pinned messages
function renderChatMessages(clubId) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    // Sort messages to show pinned ones first
    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}" data-message-id="${i}">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                <p>${sanitizeInput(msg.text)}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                        <div onclick="pinMessage('${clubId}', ${i})">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Add CSS for pinned messages
const style = document.createElement('style');
style.textContent = `
    .chat-message.pinned {
        border-left: 4px solid var(--accent-color);
        background: var(--table-highlight);
    }
    .pinned-icon {
        position: absolute;
        top: 5px;
        left: 5px;
        color: var(--accent-color);
    }
`;
document.head.appendChild(style);

// Handle club settings modal
function openClubSettings() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    if (!club || (club.creator.id !== currentUserId && !club.moderators.includes(currentUserId))) {
        showNotification('You do not have permission to edit club settings.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'club-settings-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Club Settings</h3>
                <button class="neumorphic-btn" onclick="closeModal('club-settings-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="club-settings-form">
                    <div class="form-group">
                        <label for="settings-desc">Description</label>
                        <textarea id="settings-desc" name="description">${sanitizeInput(club.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="settings-type">Type</label>
                        <select id="settings-type" name="type">
                            <option value="public" ${club.type === 'public' ? 'selected' : ''}>Public</option>
                            <option value="restricted" ${club.type === 'restricted' ? 'selected' : ''}>Restricted</option>
                            <option value="private" ${club.type === 'private' ? 'selected' : ''}>Private</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="settings-mature">Mature (18+)</label>
                        <input type="checkbox" id="settings-mature" name="mature" ${club.mature ? 'checked' : ''}>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('club-settings-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('club-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('settings-desc').value.trim();
        const type = document.getElementById('settings-type').value;
        const mature = document.getElementById('settings-mature').checked;

        await safeExecute(async () => {
            const updatedClub = await apiRequest(`/api/clubs/${currentClubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ description, type, mature })
            });
            Object.assign(club, updatedClub);
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            renderClubLists();
            updateClubInfo();
            showNotification('Club settings updated!', 'success');
            modal.remove();
            overlay.remove();
        }, 'Failed to update club settings.');
    });
}

// Add club settings to dropdown
if (dropdownContent) {
    const settingsOption = document.createElement('div');
    settingsOption.textContent = 'Club Settings';
    settingsOption.onclick = openClubSettings;
    dropdownContent.appendChild(settingsOption);
}

// Handle message search
function searchMessages(query) {
    const currentClubId = localStorage.getItem('currentClubId');
    if (!messageData[currentClubId]) return;

    const filteredMessages = messageData[currentClubId].filter(msg =>
        msg.text.toLowerCase().includes(query.toLowerCase()) ||
        msg.sender.toLowerCase().includes(query.toLowerCase())
    );
    renderChatMessages(currentClubId, filteredMessages);
}

// Add message search input
const messageSearchInput = document.createElement('input');
messageSearchInput.type = 'text';
messageSearchInput.placeholder = 'Search messages...';
messageSearchInput.className = 'neumorphic-btn';
messageSearchInput.addEventListener('input', (e) => searchMessages(e.target.value));
document.querySelector('.chat-section').prepend(messageSearchInput);

// Handle message drafts
function saveDraft() {
    const chatInput = document.getElementById('chat-input-text');
    const currentClubId = localStorage.getItem('currentClubId');
    if (chatInput && currentClubId && chatInput.value.trim()) {
        localStorage.setItem(`draft_${currentClubId}`, chatInput.value);
    }
}

function loadDraft() {
    const chatInput = document.getElementById('chat-input-text');
    const currentClubId = localStorage.getItem('currentClubId');
    if (chatInput && currentClubId) {
        const draft = localStorage.getItem(`draft_${currentClubId}`);
        if (draft) {
            chatInput.value = draft;
        }
    }
}

document.getElementById('chat-input-text').addEventListener('input', saveDraft);
document.addEventListener('clubSelected', loadDraft);

// Handle message read receipts
function markMessageRead(clubId, messageIndex) {
    if (!messageData[clubId]?.[messageIndex]) return;
    messageData[clubId][messageIndex].readBy = messageData[clubId][messageIndex].readBy || [];
    if (!messageData[clubId][messageIndex].readBy.includes(currentUserId)) {
        messageData[clubId][messageIndex].readBy.push(currentUserId);
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (isSocketInitialized) {
            socketIO.emit('readMessage', { clubId, messageIndex, userId: currentUserId });
        }
        renderChatMessages(clubId);
    }
}

// Socket.IO read receipt handling
if (isSocketInitialized) {
    socketIO.on('readMessage', ({ clubId, messageIndex, userId }) => {
        if (messageData[clubId]?.[messageIndex]) {
            messageData[clubId][messageIndex].readBy = messageData[clubId][messageIndex].readBy || [];
            if (!messageData[clubId][messageIndex].readBy.includes(userId)) {
                messageData[clubId][messageIndex].readBy.push(userId);
                localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
                if (clubId === localStorage.getItem('currentClubId')) {
                    renderChatMessages(clubId);
                }
            }
        }
    });
}

// Update renderChatMessages for read receipts
function renderChatMessages(clubId, messages = null) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messages || messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        const readBy = msg.readBy?.length ? `Read by ${msg.readBy.length} user(s)` : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}" data-message-id="${i}" onclick="markMessageRead('${clubId}', ${i})">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                <p>${sanitizeInput(msg.text)}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${readBy ? `<div class="read-receipt">${readBy}</div>` : ''}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                        <div onclick="pinMessage('${clubId}', ${i})">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Add CSS for read receipts
style.textContent += `
    .read-receipt {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 5px;
    }
`;

// Handle message timestamps
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        month: 'short',
        day: 'numeric'
    });
}

// Update renderChatMessages for timestamps
function renderChatMessages(clubId, messages = null) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messages || messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        const readBy = msg.readBy?.length ? `Read by ${msg.readBy.length} user(s)` : '';
        const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}" data-message-id="${i}" onclick="markMessageRead('${clubId}', ${i})">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                <p>${sanitizeInput(msg.text)}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${readBy ? `<div class="read-receipt">${readBy}</div>` : ''}
                ${timestamp ? `<div class="timestamp">${timestamp}</div>` : ''}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                        <div onclick="pinMessage('${clubId}', ${i})">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Add CSS for timestamps
style.textContent += `
    .timestamp {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 5px;
        text-align: right;
    }
`;

// Handle message mentions
function parseMentions(text) {
    const mentionRegex = /@(\w+)/g;
    return text.replace(mentionRegex, (match, username) => {
        const user = clubData
            .find(c => c.id === localStorage.getItem('currentClubId'))
            ?.members.find(m => m.username === username);
        if (user) {
            return `<span class="mention" onclick="viewProfile('${user.id}')">@${username}</span>`;
        }
        return match;
    });
}

// Add CSS for mentions
style.textContent += `
    .mention {
        color: var(--accent-color);
        cursor: pointer;
        font-weight: 600;
    }
    .mention:hover {
        text-decoration: underline;
    }
`;

// Update renderChatMessages for mentions
function renderChatMessages(clubId, messages = null) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messages || messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        const readBy = msg.readBy?.length ? `Read by ${msg.readBy.length} user(s)` : '';
        const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        const text = parseMentions(sanitizeInput(msg.text));
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}" data-message-id="${i}" onclick="markMessageRead('${clubId}', ${i})">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                <p>${text}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${readBy ? `<div class="read-receipt">${readBy}</div>` : ''}
                ${timestamp ? `<div class="timestamp">${timestamp}</div>` : ''}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                        <div onclick="pinMessage('${clubId}', ${i})">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// View user profile
function viewProfile(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>User Profile</h3>
                <button class="neumorphic-btn" onclick="this.closest('.modal').remove()">Close</button>
            </div>
            <div class="modal-body">
                <p>Username: ${sanitizeInput(userId)}</p>
                <p>Member since: ${new Date().toLocaleDateString()}</p>
                <!-- Add more profile info as needed -->
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

// Handle message replies
function replyToMessage(clubId, messageIndex) {
    const message = messageData[clubId]?.[messageIndex];
    if (!message) return;

    const chatInput = document.getElementById('chat-input-text');
    if (chatInput) {
        chatInput.value = `Replying to @${message.sender}: `;
        chatInput.focus();
        chatInput.dataset.replyTo = messageIndex;
    }
}

// Update send message to handle replies
document.getElementById('send-message-btn').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input-text');
    const mediaInput = document.getElementById('chat-media-input-file');
    const currentClubId = localStorage.getItem('currentClubId');
    if (!chatInput || !currentClubId) {
        showNotification('Cannot send message. Missing input or club ID.', 'error');
        return;
    }
    const text = chatInput.value?.trim();
    const mediaFile = mediaInput?.files?.[0];
    if (!text && !mediaFile) {
        showNotification('Message or media is required.', 'error');
        return;
    }
    const replyTo = chatInput.dataset.replyTo;
    const message = {
        id: `msg-${Date.now()}`,
        senderId: currentUserId,
        sender: currentUsername,
        text: text || '',
        timestamp: new Date().toISOString(),
        replyTo: replyTo ? parseInt(replyTo) : null
    };

    if (mediaFile && validateFile(mediaFile)) {
        const reader = new FileReader();
        reader.onload = () => {
            if (mediaFile.type.includes('image/')) {
                message.image = reader.result;
            } else if (mediaFile.type.includes('video/')) {
                message.video = reader.result;
            }
            if (isSocketInitialized) {
                socketIO.emit('message', { clubId: currentClubId, message });
            }
            saveMessage(currentClubId, message);
            renderChatMessages(currentClubId);
            chatInput.value = '';
            mediaInput.value = '';
            delete chatInput.dataset.replyTo;
        };
        reader.readAsDataURL(mediaFile);
    } else {
        if (isSocketInitialized) {
            socketIO.emit('message', { clubId: currentClubId, message });
        }
        saveMessage(currentClubId, message);
        renderChatMessages(currentClubId);
        chatInput.value = '';
        delete chatInput.dataset.replyTo;
    }
});

// Update renderChatMessages for replies
function renderChatMessages(clubId, messages = null) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messages || messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        const readBy = msg.readBy?.length ? `Read by ${msg.readBy.length} user(s)` : '';
        const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        const text = parseMentions(sanitizeInput(msg.text));
        const replyTo = msg.replyTo !== null && messageData[clubId][msg.replyTo]
            ? `<div class="reply-preview" onclick="highlightMessage(${msg.replyTo})">
                <span>${sanitizeInput(messageData[clubId][msg.replyTo].sender)}:</span>
                ${sanitizeInput(messageData[clubId][msg.replyTo].text.slice(0, 50)) + '...'}
               </div>`
            : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}" data-message-id="${i}" onclick="markMessageRead('${clubId}', ${i})">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                ${replyTo}
                <p>${text}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${readBy ? `<div class="read-receipt">${readBy}</div>` : ''}
                ${timestamp ? `<div class="timestamp">${timestamp}</div>` : ''}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                ${msg.senderId === currentUserId ? `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                        <div onclick="pinMessage('${clubId}', ${i})">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                        <div onclick="replyToMessage('${clubId}', ${i})">Reply</div>
                    </div>
                ` : `
                    <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                    <div class="message-menu-content">
                        <div onclick="replyToMessage('${clubId}', ${i})">Reply</div>
                    </div>
                `}
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Add CSS for reply previews
style.textContent += `
    .reply-preview {
        background: var(--bg-light);
        border-left: 2px solid var(--accent-color);
        padding: 5px;
        margin-bottom: 5px;
        font-size: 12px;
        cursor: pointer;
        border-radius: 4px;
    }
    .reply-preview span {
        font-weight: 600;
        color: var(--accent-color);
    }
    .reply-preview:hover {
        background: var(--table-highlight);
    }
    .chat-message.highlighted {
        background: var(--table-highlight);
        animation: highlight 2s ease-out;
    }
    @keyframes highlight {
        from { background: var(--accent-color); }
        to { background: var(--table-highlight); }
    }
`;

// Highlight replied message
function highlightMessage(messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-message-id="${messageIndex}"]`);
    if (messageEl) {
        messageEl.classList.add('highlighted');
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => messageEl.classList.remove('highlighted'), 2000);
    }
}

// Handle message forwarding
function forwardMessage(clubId, messageIndex) {
    const message = messageData[clubId]?.[messageIndex];
    if (!message) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Forward Message</h3>
                <button class="neumorphic-btn" onclick="this.closest('.modal').remove()">Close</button>
            </div>
            <div class="modal-body">
                <p>Select a club to forward this message to:</p>
                <select id="forward-club-select">
                    ${clubData
                        .filter(c => c.members.includes(currentUserId))
                        .map(c => `<option value="${c.id}">${sanitizeInput(c.name)}</option>`)
                        .join('')}
                </select>
                <div class="modal-buttons">
                    <button class="neumorphic-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="neumorphic-btn primary" onclick="confirmForwardMessage('${clubId}', ${messageIndex})">Forward</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

function confirmForwardMessage(clubId, messageIndex) {
    const select = document.getElementById('forward-club-select');
    const targetClubId = select.value;
    const message = messageData[clubId][messageIndex];
    if (!message || !targetClubId) return;

    const forwardedMessage = {
        id: `msg-${Date.now()}`,
        senderId: currentUserId,
        sender: currentUsername,
        text: `Forwarded from ${clubId}: ${message.text}`,
        image: message.image,
        video: message.video,
        timestamp: new Date().toISOString()
    };

    saveMessage(targetClubId, forwardedMessage);
    if (isSocketInitialized) {
        socketIO.emit('message', { clubId: targetClubId, message: forwardedMessage });
    }
    if (targetClubId === localStorage.getItem('currentClubId')) {
        renderChatMessages(targetClubId);
    }
    showNotification('Message forwarded!', 'success');
    document.querySelector('.modal.active')?.remove();
    document.querySelector('.modal-overlay')?.remove();
}

// Add forward to message menu
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.chat-message.own .message-menu-content').forEach(menu => {
        const forwardOption = document.createElement('div');
        forwardOption.textContent = 'Forward';
        forwardOption.onclick = () => {
            const messageEl = menu.closest('.chat-message');
            const clubId = localStorage.getItem('currentClubId');
            const messageIndex = parseInt(messageEl.dataset.messageId);
            forwardMessage(clubId, messageIndex);
        };
        menu.appendChild(forwardOption);
    });
});

// Handle message deletion for all (moderator)
function deleteMessageForAll(clubId, messageIndex) {
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to delete this message.', 'error');
        return;
    }

    if (confirm('Are you sure you want to delete this message for all members?')) {
        messageData[clubId].splice(messageIndex, 1);
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (isSocketInitialized) {
            socketIO.emit('deleteMessageForAll', { clubId, messageIndex });
        }
        renderChatMessages(clubId);
        showNotification('Message deleted for all.', 'success');
    }
}

// Socket.IO delete message for all
if (isSocketInitialized) {
    socketIO.on('deleteMessageForAll', ({ clubId, messageIndex }) => {
        if (messageData[clubId]?.[messageIndex]) {
            messageData[clubId].splice(messageIndex, 1);
            localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
            if (clubId === localStorage.getItem('currentClubId')) {
                renderChatMessages(clubId);
            }
        }
    });
}

// Add delete for all to message menu for moderators
function updateMessageMenu() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    document.querySelectorAll('.chat-message .message-menu-content').forEach(menu => {
        const messageEl = menu.closest('.chat-message');
        const messageIndex = parseInt(messageEl.dataset.messageId);
        if (club.moderators.includes(currentUserId) || club.creator.id === currentUserId) {
            const deleteAllOption = document.createElement('div');
            deleteAllOption.textContent = 'Delete for All';
            deleteAllOption.onclick = () => deleteMessageForAll(clubId, messageIndex);
            menu.appendChild(deleteAllOption);
        }
    });
}

document.addEventListener('messagesRendered', updateMessageMenu);

// Handle message edit history
function viewEditHistory(clubId, messageIndex) {
    const message = messageData[clubId]?.[messageIndex];
    if (!message?.editHistory?.length) {
        showNotification('No edit history available.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit History</h3>
                <button class="neumorphic-btn" onclick="this.closest('.modal').remove()">Close</button>
            </div>
            <div class="modal-body">
                <ul>
                    ${message.editHistory.map((edit, i) => `
                        <li>
                            <p>Version ${i + 1}: ${sanitizeInput(edit.text)}</p>
                            <p>Edited at: ${formatTimestamp(edit.timestamp)}</p>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

// Update editMessage to save history
function editMessage(clubId, messageIndex) {
    const message = messageData[clubId]?.[messageIndex];
    if (!message || !message.text) {
        showNotification('Only text messages can be edited.', 'error');
        return;
    }
    const editInput = document.getElementById('edit-message-input');
    const editForm = document.getElementById('edit-message-form');
    if (!editInput || !editForm) return;

    editInput.value = message.text;
    toggleModal('edit-message-modal', true);
    editForm.onsubmit = (e) => {
        e.preventDefault();
        const newText = editInput.value?.trim();
        if (newText && newText !== message.text) {
            message.editHistory = message.editHistory || [];
            message.editHistory.push({
                text: message.text,
                timestamp: new Date().toISOString()
            });
            message.text = newText;
            message.isEdited = true;
            localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
            if (isSocketInitialized) {
                socketIO.emit('editMessage', { clubId, messageIndex, newText, editHistory: message.editHistory });
            }
            renderChatMessages(clubId);
            toggleModal('edit-message-modal', false);
            showNotification('Message edited successfully!', 'success');
        }
    };
}

// Add view edit history to message menu
function addEditHistoryOption(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message-id="${messageIndex}"]`);
    if (!messageEl) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent && messageData[clubId][messageIndex]?.isEdited) {
        const historyOption = document.createElement('div');
        historyOption.textContent = 'View Edit History';
        historyOption.onclick = () => viewEditHistory(clubId, messageIndex);
        menuContent.appendChild(historyOption);
    };
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((message, index) => {
        if (message.isEdited) {
            addEditHistoryOption(clubId, index);
        }
    });
});

// Handle club member management
function manageMembers() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('notification', 'You do not have permission to manage members.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'club-members-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Club Members - ${sanitizeInput(club.title || club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('club-members-modal')">Close</button>
            </div>
            <div class="modal-body">
                <h4>Members (${club.members.length})</h4>
                <ul>
                    ${club.members.map(member => `
                        <li>
                            ${sanitizeInput(member.username || member.id)}
                            ${club.creator.id === member.id ? '(Owner)' : ''}
                            ${club.moderators.includes(member.id) ? '(Moderator)' : ''}
                            ${member.id !== currentUserId && (club.creator.id === currentUserId || club.moderators.includes(currentUserId)) ? `
                                <button class="neumorphic-btn" onclick="toggleModerator('${sanitizeInput(clubId)}', '${sanitizeInput(member.id)}')">
                                    ${club.moderators.includes(member.id) ? 'Remove Moderator' : 'Make Moderator'}
                                </button>
                                <button class="neumorphic-btn error" onclick="kickMember('${sanitizeInput(clubId)}', '${sanitizeInput(member.id)}')">Kick</button>
                            ` : ''}
                        </li>
                    `).join('')}
                </ul>
                <h4>Pending Invites</h4>
                <ul id="pending-invites-list">
                    ${club.pendingInvites?.length > 0 ? club.pendingInvites.map(invite => `
                        <li>
                            ${sanitizeInput(invite.username || invite.userId)}
                            <button class="neumorphic-btn error" onclick="cancelInvite('${sanitizeInput(clubId)}', '${sanitizeInput(invite.userId)}')">Cancel</button>
                        </li>
                    `).join('') : '<li>No pending invitations.</li>'}
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay active';
    document.body.appendChild(modalOverlay);
    modalOverlay.addEventListener('click', () => {
        modal.remove();
        modalOverlay.remove();
    });
}

    // Fetch pending invites
    safeExecute(async () => {
        const pendingInvites = await apiRequest(`/api/clubs/${clubId}/pendingInvites`);
        const pendingList = document.getElementById('pending-invites-list');
        if (pendingInvites.length > 0) {
            pendingList.innerHTML = pendingInvites.map(invite => `
                <li>
                    ${sanitizeInput(invite.user.username || invite.user.id)}
                    <button class="neumorphic-button primary" onclick="acceptInvite('${clubId}', '${invite.userId}')">Accept</button>
                    <button class="neumorphic-button error" onclick="rejectInvite('${clubId}', '${invite.userId}')">Reject</button>
                </li>
            `).join('');
        }
    }, 'Failed to load pending invitations.');

function toggleModerator(clubId, userId) {
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    if (club.moderators.includes(userId)) {
        club.moderators = club.moderators.filter(m => m !== userId);
    } else {
        club.moderators.push(userId);
    }

    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ moderators: club.moderators })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(`User ${userId} ${club.moderators.includes(userId) ? 'promoted' : 'demoted'} to moderator!`, 'success');
        manageMembers(); // Refresh modal
    }, 'Failed to update moderator status.');
}

function kickMember(clubId, userId) {
    if (!confirm(`Are you sure you want to kick ${userId} from the club?`)) return;

    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.members = clubData.members.filter(m => m.id !== userId);
    club.moderators = clubData.moderators.filter(m => m !== userId);

    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ members: club.members, moderators: club.moderators })
        });
        localStorage.setItem(`clubs_${currentClubId}`, JSON.stringify(clubData));
        if (isSocketInitialized) {
            socketIO.emit('kickedMember', { clubId, userId });
        }
        showNotification(`User ${userId} kicked from club!`, 'success');
        manageMembers(); // Refresh modal
    }, 'Failed to kick member.');
}

function acceptInvite(clubId, userId) {
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}/invites/${userId}/accept`, { method: 'POST' });
        const club = clubData.find(c => c.id === clubId);
        if (club) {
            club.members.push(userId);
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            if (isSocketInitialized) {
                socketIO.emit('joinClub', { clubId, userId });
            }
            showNotification(`Invite accepted for ${userId}!`, 'success');
            manageMembers();
        }
    }, 'Failed to accept invitation.');
}

function rejectInvite(clubId, userId) {
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}/invites/${userId}/reject`, { method: 'POST' });
        showNotification(`Invite rejected for ${userId}.`, 'success');
        manageMembers();
    }, 'Failed to reject invitation.');
}

// Add manage members to dropdown
if (dropdownContent) {
    const membersOption = document.createElement('div');
    membersOption.textContent = 'Manage Members';
    membersOption.onclick = manageMembers;
    dropdownContent.appendChild(clubMembersOption);
}

// Socket.IO kick member
if (isSocketInitialized) {
    socket.IO.on('kickedMember', ({ clubId, userId }) => {
        if (userId === currentUserId) {
            clubData = clubData.filter(c => c.id !== clubId);
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            localStorage.setItem(`chat_${clubId}`);
            localStorage.removeItem('currentClubId');
            showNotification('You have been kicked from the club.', 'error');
            renderClubLists();
            } else {
                const club = clubData.find(c => c.id === idclubId);
                if (club) {
                    club.members = club.members.filter(m => m.id !== userId);
                    club.moderators = club.moderators.filter(m => m !== userId);
                    localStorage.setItem(`clubs_${currentClubId}`, JSON.stringify(clubData));
                    if (clubId === localStorage.getItem('currentClubId')) {
                        updateClubInfo(clubId);
                    }
                }
            }
        });
}

// Handle club notifications
function sendClubNotification(clubId, message) {
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to send notifications.', 'error');
        return;
    }

    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}/notifications`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
        if (isSocketInitialized) {
            socketIO.emit('clubNotification', { clubId, message });
        }
        showNotification(`Notification sent: ${message}`, 'success');
    }, 'Failed to send club notification.');
}

// Socket.IO club notifications
if (isSocketInitialized) {
    socketIO.on('clubNotification', ({ clubId, message }) => {
        if (clubId === localStorage.getItem('currentClubId')) {
            showNotification(`Club Notification: ${message}`, 'success');
        }
    });
}

// Add send notification to dropdown
if (dropdownContent) {
    const notificationOption = document.createElement('div');
    notificationOption.textContent = 'Send Notification';
    notificationOption.onclick = () => {
        const clubId = localStorage.getItem('currentClubId');
        const message = prompt('Enter notification message:');
        if (message) {
            sendClubNotification(clubId, message);
        }
    };
    dropdownContent.appendChild(notificationOption);
}

// Handle club analytics
function viewAnalytics() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) || club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to view analytics.', 'error');
        return;
    }

    safeExecute(async () => {
        const analytics = await apiRequest(`/api/clubs/${clubId}/analytics`);
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'club-analytics-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Club Analytics - ${sanitizeInput(club.title || club.name)}</h3>
                    <button class="closeModal('club-analytics-modal', false)">Close</button>
                </div>
                <div class="modal-body">
                    <p>Active Members: ${analytics.activeMembers}</p>
                    <p>Messages Sent (Last 30 days): ${analytics.messages}</p>
                    <p>Joins (Last 7 days): ${analytics.joins}</p>
                    <p>Leaves (Last 7 days): ${analytics.leaves}</p>
                    <!-- Add more analytics as needed -->
                </div>
                </div>
            </div>
        `;
        }).document.body.appendChild(modal);
        const analyticsOverlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        document.body.appendChild(analyticsOverlay);
        overlay.addEventListener('click', () => {
            modal.remove();
            overlay.remove();
        });
    } 'Failed to load analytics.';

// Add analytics to dropdown
if (dropdownContent) {
    const analyticsOption = document.createElement('div');
    analyticsOption.textContent = 'View Analytics';
    analyticsOption.onclick = viewAnalytics;
    dropdownContent.appendChild(analyticsOption);
}

// Handle club events
function createClubEvent() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === idclubId);
    if (!club || (!club.moderators.includes(currentUserId) || club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to create events.', 'error');
        return;
    }

    const eventModal = modal.createElement('div');
    modal.className = 'modal active';
    modal.id = 'club-event-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create Event - ${sanitizeInput(club.title || club.name)}</h3>
                <button class="closeModal('club-event-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="event-form">
                    <div class="form-group">
                        <label for="event-title">Event Title</label>
                        <input type="text" id="event-title-text" name="title" placeholder="Event Name" required>
                    </div>
                    <div class="form-group">
                        <label for="event-date">Date and Time</label>
                        <input type="datetime-local" id="event-date" name="datetime" required>
                    </div>
                    <div class="form-group">
                        <label for="event-description">Description</label>
                        <textarea id="event-description-textarea" name="description-textarea" placeholder="Event description"></textarea>
                    </div>
                    <div class="modal-buttons">
                        <div>
                            <button type="neumorphic-btn" onclick="closeModal('club-event-modal', false)">Cancel</button>
                            <button type="submit" class="submit-primary neumorphic-btn primary">Create</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        `;
    }document.body.appendChild(eventModal);
    const modalOverlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(modalOverlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('event-title-input');
    const dateInput = document.getElementById('event-date-input');
    const descriptionInput = document.getElementById('event-description-input');
    const clubId = localStorage.getItem('currentClubId');
    const event = {
        id: `event-${Date.now()}`,
        title: titleInput.value.trim(),
        date: new Date(dateInput.value),
        description: descriptionInput.value.trim(),
        clubId: clubId,
        creatorId: currentUserId,
        attendees: [currentUserId]
    };

    await safeExecute(async () => {
        const createdEvent = await apiRequest(`/api/clubs/${clubId}/events`, {
            method: 'POST',
            body: JSON.stringify(event)
        });
        if (isSocketInitialized) {
            socketIO.emit('eventCreated', { clubId, event: createdEvent });
        }
        showNotification('notification', 'Event created successfully!', 'success');
        const modal = document.getElementById('event-modal');
        const modalOverlay = document.querySelector('.modal-overlay.active');
        modal?.remove();
        modalOverlay?.remove();
        displayEvents(clubId);
    }, 'Failed to create event.');
});

// Display events
function displayEvents(clubId) {
    const clubInfoSection = document.getElementById('club-info-section');
    if (!clubInfoSection) return;

    safeExecute(async () => {
        const clubEvents = await apiRequest(`/api/clubs/${clubId}/events`);
        const eventsDiv = document.createElement('div');
        eventsDiv.className = 'club-events';
        eventsDiv.innerHTML = '<h4>Upcoming Events</h4>';
        if (events.length === 0) {
            eventsDiv.innerHTML += clubEvents.map(event => `
                <div class="event-item">
                    <h5>${sanitizeInput(event.title)}</h5>
                    <p>${formatDateTime(new Date(event.date))}</p>
                    <p>${sanitizeInput(event.description || '')}</p>
                    <p>Attendees: ${event.attendees.length}</p>
                    <button class="attend-event-btn" onclick="toggleAttendEvent('${clubId}', '${event.id}')">
                        ${event.attendees.includes(currentUserId) ? 'Leave Event' : 'Attend Event'}</button>
                    </div>
                </div>
            `).join('');
        } else {
            eventsDiv.innerHTML = '<p>No upcoming events.</p>';
			clubInfoSection.appendChild(eventsDiv);
    } 'Failed to load club events.';

// Toggle event attendance
function toggleAttendEvent(clubId, eventId) {
    safeExecute(async () => {
        const event = await apiRequest(`/api/clubs/${clubId}/events/${eventId}`);
        if (event.attendees.includes(currentUserId)) {
            event.attendees = event.attendees.filter(id => id !== currentUserId);
        } else {
            event.attendees.push(currentUserId);
        }
        await apiRequest(`/api/clubs/${clubId}/events/${eventId}`, {
            method: 'PATCH',
            body: JSON.stringify({ attendees: event.attendees })
        });
        if (isSocketInitialized) {
            socketIO.emit('eventAttendance', { clubId, eventId, userId: currentUserId, attending: event.attendees.includes(currentUserId) });
        }
        showNotification(event.attendees.includes(currentUserId) ? 'You are attending the event!' : 'You have left the event.', 'success');
        displayEvents(clubId);
    }, 'Failed to update event attendance.');
}

// Socket.IO event attendance
if (isSocketInitialized) {
    socketIO.on('eventAttendance', ({ clubId, eventId, userId, attending }) => {
        if (clubId === localStorage.getItem('currentClubId')) {
            displayEvents(clubId);
        }
    });
}

// Add create event to dropdown
if (dropdownContent) {
    const eventOption = document.createElement('div');
    eventOption.textContent = 'Create Event';
    eventOption.onclick = createClubEvent;
    dropdownContent.appendChild(eventOption);
}

// Handle club polls
function createPoll() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to create polls.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'poll-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create Poll - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('poll-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="poll-form">
                    <div class="form-group">
                        <label for="poll-question">Question</label>
                        <input type="text" id="poll-question" name="question" required>
                    </div>
                    <div id="poll-options">
                        <div class="form-group">
                            <label for="option-1">Option 1</label>
                            <input type="text" id="option-1" name="options" required>
                        </div>
                        <div class="form-group">
                            <label for="option-2">Option 2</label>
                            <input type="text" id="option-2" name="options" required>
                        </div>
                    </div>
                    <button type="button" class="neumorphic-btn" onclick="addPollOption()">Add Option</button>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('poll-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Create Poll</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('poll-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = document.getElementById('poll-question').value.trim();
        const options = Array.from(document.querySelectorAll('#poll-options input')).map(input => input.value.trim()).filter(op => op);
        if (options.length < 2) {
            showNotification('At least two options are required.', 'error');
            return;
        }

        const poll = {
            id: `poll-${Date.now()}`,
            question,
            options: options.map(option => ({ text: option, votes: 0 })),
            clubId,
            creatorId: currentUserId,
            voters: []
        };

        await safeExecute(async () => {
            await apiRequest(`/api/clubs/${clubId}/polls`, {
                method: 'POST',
                body: JSON.stringify(poll)
            });
            if (isSocketInitialized) {
                socketIO.emit('pollCreated', { clubId, poll });
            }
            showNotification('Poll created successfully!', 'success');
            modal.remove();
            overlay.remove();
            displayPolls(clubId);
        }, 'Failed to create poll.');
    });
}

function addPollOption() {
    const pollOptions = document.getElementById('poll-options');
    const optionCount = pollOptions.querySelectorAll('.form-group').length + 1;
    const optionDiv = document.createElement('div');
    optionDiv.className = 'form-group';
    optionDiv.innerHTML = `
        <label for="option-${optionCount}">Option ${optionCount}</label>
        <input type="text" id="option-${optionCount}" name="options">
    `;
    pollOptions.appendChild(optionDiv);
}

// Display polls
function displayPolls(clubId) {
    const clubInfoSection = document.getElementById('club-info-section');
    if (!clubInfoSection) return;

    safeExecute(async () => {
        const polls = await apiRequest(`/api/clubs/${clubId}/polls`);
        const pollsDiv = document.createElement('div');
        pollsDiv.className = 'club-polls';
        pollsDiv.innerHTML = '<h4>Active Polls</h4>';

        // Clear existing polls to prevent duplication
        const existingPolls = clubInfoSection.querySelector('.club-polls');
        if (existingPolls) existingPolls.remove();

        if (polls.length > 0) {
            pollsDiv.innerHTML += polls.map(poll => `
                <div class="poll-item">
                    <h5>${sanitizeInput(poll.question)}</h5>
                    ${poll.options.map((option, index) => `
                        <div class="poll-option">
                            <input type="radio" name="poll-${poll.id}" id="poll-${poll.id}-${index}"
                                   ${poll.voters.includes(currentUserId) ? 'disabled' : ''}
                                   onclick="votePoll('${sanitizeInput(clubId)}', '${sanitizeInput(poll.id)}', ${index})">
                            <label for="poll-${poll.id}-${index}">${sanitizeInput(option.text)} (${option.votes})</label>
                        </div>
                    `).join('')}
                    <p>Total votes: ${poll.voters.length}</p>
                </div>
            `).join('');
        } else {
            pollsDiv.innerHTML += '<p>No active polls.</p>';
        }
        clubInfoSection.appendChild(pollsDiv);
    }, 'Failed to load polls.');
}

function votePoll(clubId, pollId, optionIndex) {
    safeExecute(async () => {
        const poll = await apiRequest(`/api/clubs/${clubId}/polls/${pollId}`); // Corrected template literal
        if (poll.voters.includes(currentUserId)) {
            showNotification('notification', 'You have already voted in this poll.', 'error');
            return false;
        }
        poll.options[optionIndex].votes += 1;
        poll.voters.push(currentUserId);
        await apiRequest(`/api/clubs/${clubId}/polls/${pollId}`, {
            method: 'PATCH',
            body: JSON.stringify({ options: poll.options, voters: poll.voters })
        });
        if (isSocketInitialized) {
            socketIO.emit('pollVoted', { clubId, pollId, optionIndex, userId: currentUserId });
        }
        showNotification('notification', 'Vote submitted!', 'success');
        displayPolls(clubId);
    }, 'Failed to submit vote.');
}

// Socket.IO poll vote handling
if (isSocketInitialized) {
    socketIO.on('pollVoted', ({ clubId, pollId, optionIndex, userId }) => {
        if (clubId === localStorage.getItem('currentClubId')) {
            displayPolls(clubId);
        }
    });
}

// Add create poll to dropdown
if (dropdownContent) {
    const pollOption = document.createElement('div');
    pollOption.textContent = 'Create Poll';
    pollOption.onclick = createPoll;
    dropdownContent.appendChild(pollOption);
}

// Handle club media gallery
function showMediaGallery() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club) {
        showNotification('notification', 'Club not found.', 'error');
        return;
    }

    const clubMessages = messageData[clubId] || [];
    const mediaMessages = clubMessages.filter(m => m.image || m.video);

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'media-gallery-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Media Gallery - ${sanitizeInput(club.title || club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('media-gallery-modal')">Close</button>
            </div>
            <div class="modal-body">
                <div class="media-gallery">
                    ${mediaMessages.length > 0 ? mediaMessages.map(msg => `
                        <div class="media-item">
                            ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Club media" class="media-image">` : ''}
                            ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls class="media-video"></video>` : ''}
                            <p>Posted by ${sanitizeInput(msg.senderUsername || 'Unknown')} on ${new Date(msg.timestamp).toLocaleString()}</p>
                        </div>
                    `).join('') : '<p>No media available.</p>'}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay active';
    document.body.appendChild(modalOverlay);
    modalOverlay.addEventListener('click', () => {
        modal.remove();
        modalOverlay.remove();
    });
}

// Add media gallery to dropdown
if (dropdownContent) {
    const mediaGalleryOption = document.createElement('div');
    mediaGalleryOption.textContent = 'Media Gallery';
    galleryOption.onclick = showMediaGallery;
    dropdownContent.appendChild(mediaGalleryOption);
}

// Handle club tags
function manageTags() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('notification', 'You do not have permission to manage tags.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'tags-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Tags - ${sanitizeInput(club.title || club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('tags-modal')">Close</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="new-tag-input">Add New Tag</label>
                    <input type="text" id="new-tag-input" placeholder="Enter tag name">
                    <button class="neumorphic-btn" onclick="addTag('${sanitizeInput(clubId)}')">Add Tag</button>
                </div>
                <h4>Current Tags:</h4>
                <ul id="tag-list">
                    ${club.tags?.length > 0 ? club.tags.map(tag => `
                        <li>
                            ${sanitizeInput(tag)}
                            <button class="neumorphic-btn error" onclick="removeTag('${sanitizeInput(clubId)}', '${sanitizeInput(tag)}')">Remove</button>
                        </li>
                    `).join('') : '<p>No tags yet.</p>'}
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const tagsOverlay = document.createElement('div');
    tagsOverlay.className = 'modal-overlay active';
    document.body.appendChild(tagsOverlay);
    tagsOverlay.addEventListener('click', () => {
        modal.remove();
        tagsOverlay.remove();
    });
}

function addTag(clubId) {
    const input = document.getElementById('new-tag-input');
    const tag = input.value.trim();
    if (!tag) {
        showNotification('Tag name cannot be empty.', 'error');
        return;
    }

    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.tags = club.tags || [];
    if (!club.tags.includes(tag)) {
        club.tags.push(tag);
        safeExecute(async () => {
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ tags: club.tags })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            showNotification(`Tag "${tag}" added!`, 'success');
            manageTags();
        }, 'Failed to add tag.');
    } else {
        showNotification('Tag already exists.', 'error');
    }
}

function removeTag(clubId, tag) {
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.tags = club.tags.filter(t => t !== tag);
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ tags: club.tags })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(`Tag "${tag}" removed!`, 'success');
        manageTags();
    }, 'Failed to remove tag.');
}

// Add manage tags to dropdown
if (dropdownContent) {
    const tagsOption = document.createElement('div');
    tagsOption.textContent = 'Manage Tags';
    tagsOption.onclick = manageTags;
    dropdownContent.appendChild(tagsOption);
}

// Update club info with tags
function updateClubInfo() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    const clubInfoSection = document.getElementById('club-info-section');
    if (club && clubInfoSection) {
        clubInfoSection.innerHTML = `
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)}" width="200" />
            <h2>${sanitizeInput(club.name)}</h2>
            <p>${sanitizeInput(club.description || 'No description provided.')}</p>
            <p>Type: ${sanitizeInput(club.type.charAt(0).toUpperCase() + club.type.slice(1))}</p>
            <p>Members: ${club.members.length}</p>
            <p>Online: ${club.online || 0}</p>
            <p>Created by: ${sanitizeInput(club.creator?.username || 'Unknown')}</p>
            <p class="membership-status">
                Status: ${club.members.includes(currentUserId) ? 'Member' : 'Not a Member'}
            </p>
            ${club.tags?.length ? `
                <p>Tags: ${club.tags.map(tag => `<span class="tag">${sanitizeInput(tag)}</span>`).join(' ')}</p>
            ` : ''}
        `;
        displayEvents(clubId);
        displayPolls(clubId);
    }
}

// Add CSS for tags
style.textContent += `
    .tag {
        background: var(--accent-color);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        margin-right: 5px;
        font-size: 12px;
    }
`;

// Handle club search with tags
function searchClubs(query) {
    const filteredClubs = clubData.filter(club =>
        club.name.toLowerCase().includes(query.toLowerCase()) ||
        club.description?.toLowerCase().includes(query.toLowerCase()) ||
        club.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    renderClubLists(filteredClubs);
}

// Handle user settings
function openUserSettings() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'user-settings-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>User Settings</h3>
                <button class="neumorphic-btn" onclick="closeModal('user-settings-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="user-settings-form">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" name="username" value="${sanitizeInput(currentUsername)}" required>
                    </div>
                    <div class="form-group">
                        <label for="profile-pic">Profile Picture</label>
                        <input type="file" id="profile-pic" name="profile-pic" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="bio">Bio</label>
                        <textarea id="bio" name="bio">${sanitizeInput(userData.bio || '')}</textarea>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('user-settings-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('user-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const bio = document.getElementById('bio').value.trim();
        const profilePic = document.getElementById('profile-pic').files[0];

        await safeExecute(async () => {
            const updates = { username, bio };
            if (profilePic && validateFile(profilePic)) {
                const reader = new FileReader();
                reader.onload = async () => {
                    updates.profilePic = reader.result;
                    await apiRequest(`/api/users/${currentUserId}`, {
                        method: 'PATCH',
                        body: JSON.stringify(updates)
                    });
                    currentUsername = username;
                    userData.bio = bio;
                    userData.profilePic = updates.profilePic;
                    localStorage.setItem(`user_${currentUserId}`, JSON.stringify(userData));
                    showNotification('Profile updated!', 'success');
                    modal.remove();
                    overlay.remove();
                };
                reader.readAsDataURL(profilePic);
            } else {
                await apiRequest(`/api/users/${currentUserId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updates)
                });
                currentUsername = username;
                userData.bio = bio;
                localStorage.setItem(`user_${currentUserId}`, JSON.stringify(userData));
                showNotification('Profile updated!', 'success');
                modal.remove();
                overlay.remove();
            }
        }, 'Failed to update profile.');
    });
}

// Add user settings to dropdown
if (dropdownContent) {
    const settingsOption = document.createElement('div');
    settingsOption.textContent = 'User Settings';
    settingsOption.onclick = openUserSettings;
    dropdownContent.appendChild(settingsOption);
}

// Handle notifications settings
function openNotificationSettings() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'notification-settings-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Notification Settings</h3>
                <button class="neumorphic-btn" onclick="closeModal('notification-settings-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="notification-settings-form">
                    <div class="form-group">
                        <label for="enable-notifications">Enable Notifications</label>
                        <input type="checkbox" id="enable-notifications" name="enable-notifications" ${userData.notifications?.enabled ? 'checked' : ''}>
                    </div>
                    <div class="form-group">
                        <label for="sound-notifications">Sound Notifications</label>
                        <input type="checkbox" id="sound-notifications" name="sound-notifications" ${userData.notifications?.sound ? 'checked' : ''}>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('notification-settings-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('notification-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const enabled = document.getElementById('enable-notifications').checked;
        const sound = document.getElementById('sound-notifications').checked;

        await safeExecute(async () => {
            userData.notifications = { enabled, sound };
            await apiRequest(`/api/users/${currentUserId}`, {
                method: 'PATCH',
                body: JSON.stringify({ notifications: userData.notifications })
            });
            localStorage.setItem(`user_${currentUserId}`, JSON.stringify(userData));
            showNotification('Notification settings updated!', 'success');
            modal.remove();
            overlay.remove();
        }, 'Failed to update notification settings.');
    });
}

// Add notification settings to dropdown
if (dropdownContent) {
    const notificationSettingsOption = document.createElement('div');
    notificationSettingsOption.textContent = 'Notification Settings';
    notificationSettingsOption.onclick = openNotificationSettings;
    dropdownContent.appendChild(notificationSettingsOption);
}

// Handle club mute
function toggleClubMute() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.muted = !club.muted;
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ muted: club.muted })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(club.muted ? 'Club muted.' : 'Club unmuted.', 'success');
    }, 'Failed to update mute status.');
}

// Add mute to dropdown
if (dropdownContent) {
    const muteOption = document.createElement('div');
    muteOption.textContent = 'Toggle Mute';
    muteOption.onclick = toggleClubMute;
    dropdownContent.appendChild(muteOption);
}

// Handle club leave
function leaveClub() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || club.creator.id === currentUserId) {
        showNotification('You cannot leave a club you created.', 'error');
        return;
    }

    if (confirm('Are you sure you want to leave this club?')) {
        safeExecute(async () => {
            club.members = club.members.filter(m => m !== currentUserId);
            club.moderators = club.moderators.filter(m => m !== currentUserId);
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ members: club.members, moderators: club.moderators })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            if (isSocketInitialized) {
                socketIO.emit('leaveClub', { clubId, userId: currentUserId });
            }
            localStorage.removeItem('currentClubId');
            renderClubLists();
            showNotification('You have left the club.', 'success');
        }, 'Failed to leave club.');
    }
}

// Add leave club to dropdown
if (dropdownContent) {
    const leaveOption = document.createElement('div');
    leaveOption.textContent = 'Leave Club';
    leaveOption.onclick = leaveClub;
    dropdownContent.appendChild(leaveOption);
}

// Handle club deletion
if (dropdownContent) {
    const deleteOption = document.createElement('div');
    deleteOption.textContent = 'Delete Club';
    deleteOption.onclick = deleteClub;
    dropdownContent.appendChild(deleteOption);
}

// Periodic cleanup of old messages
setInterval(() => {
    const clubId = localStorage.getItem('currentClubId');
    if (clubId && messageData[clubId]) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        messageData[clubId] = messageData[clubId].filter(msg => new Date(msg.timestamp) > oneMonthAgo);
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (clubId === localStorage.getItem('currentClubId')) {
            renderChatMessages(clubId);
        }
    }
}, 24 * 60 * 60 * 1000); // Run daily

// Handle browser notifications
function showBrowserNotification(title, body) {
    if (userData.notifications?.enabled && Notification.permission === 'granted') {
        const notification = new Notification(title, { body });
        if (userData.notifications.sound) {
            const sound = new Audio('/assets/notification.mp3');
            sound.play();
        }
    }
}

if (Notification.permission !== 'granted') {
    Notification.requestPermission();
}

// Socket.IO new message notification
if (isSocketInitialized) {
    socketIO.on('message', ({ clubId, message }) => {
        const club = clubData.find(c => c.id === clubId);
        if (club && !club.muted && clubId !== localStorage.getItem('currentClubId')) {
            showBrowserNotification(`New Message in ${club.name}`, message.text);
        }
    });
}

// Handle emoji picker
function initEmojiPicker() {
    const chatInput = document.getElementById('chat-input-text');
    const emojiBtn = document.createElement('button');
    emojiBtn.className = 'neumorphic-btn';
    emojiBtn.innerHTML = '😊';
    emojiBtn.onclick = () => {
        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.innerHTML = `
            <span onclick="addEmoji('😊')">😊</span>
            <span onclick="addEmoji('😂')">😂</span>
            <span onclick="addEmoji('❤️')">❤️</span>
            <span onclick="addEmoji('👍')">👍</span>
            <!-- Add more emojis as needed -->
        `;
        chatInput.parentElement.appendChild(picker);
        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) && e.target !== emojiBtn) {
                picker.remove();
            }
        }, { once: true });
    };
    chatInput.parentElement.appendChild(emojiBtn);
}

function addEmoji(emoji) {
    const chatInput = document.getElementById('chat-input-text');
    chatInput.value += emoji;
    chatInput.focus();
    document.querySelector('.emoji-picker')?.remove();
}

initEmojiPicker();

// Add CSS for emoji picker
style.textContent += `
    .emoji-picker {
        position: absolute;
        bottom: 50px;
        background: var(--bg-color);
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
    }
    .emoji-picker span {
        font-size: 24px;
        margin: 5px;
        cursor: pointer;
    }
    .emoji-picker span:hover {
        background: var(--table-highlight);
        border-radius: 4px;
    }
`;

// Handle typing indicators
let typingTimeout;
function sendTypingStatus() {
    const clubId = localStorage.getItem('currentClubId');
    if (isSocketInitialized && clubId) {
        socketIO.emit('typing', { clubId, userId: currentUserId });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socketIO.emit('stopTyping', { clubId, userId: currentUserId });
        }, 3000);
    }
}

document.getElementById('chat-input-text').addEventListener('input', sendTypingStatus);

// Socket.IO typing indicators
if (isSocketInitialized) {
    socketIO.on('typing', ({ clubId, userId }) => {
        if (clubId === localStorage.getItem('currentClubId') && userId !== currentUserId) {
            const typingIndicator = document.getElementById('typing-indicator') || document.createElement('div');
            typingIndicator.id = 'typing-indicator';
            typingIndicator.textContent = `${sanitizeInput(userData[userId]?.username || 'Someone')} is typing...`;
            document.querySelector('.chat-section').appendChild(typingIndicator);
        }
    });

    socketIO.on('stopTyping', ({ clubId, userId }) => {
        if (clubId === localStorage.getItem('currentClubId')) {
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) typingIndicator.remove();
        }
    });
}

// Add CSS for typing indicator
style.textContent += `
    #typing-indicator {
        font-size: 12px;
        color: var(--text-muted);
        padding: 5px;
        position: absolute;
        bottom: 60px;
    }
`;

// Handle message drafts cleanup
function cleanupDrafts() {
    const clubId = localStorage.getItem('currentClubId');
    if (clubId) {
        localStorage.removeItem(`draft_${clubId}`);
    }
}

document.getElementById('send-message-btn').addEventListener('click', cleanupDrafts);

// Handle offline message queue
let offlineMessageQueue = JSON.parse(localStorage.getItem('offlineMessageQueue') || '[]');
function queueMessage(clubId, message) {
    offlineMessageQueue.push({ clubId, message });
    localStorage.setItem('offlineMessageQueue', JSON.stringify(offlineMessageQueue));
}

function processOfflineQueue() {
    if (navigator.onLine && isSocketInitialized) {
        offlineMessageQueue.forEach(({ clubId, message }) => {
            socketIO.emit('message', { clubId, message });
            saveMessage(clubId, message);
            if (clubId === localStorage.getItem('currentClubId')) {
                renderChatMessages(clubId);
            }
        });
        offlineMessageQueue = [];
        localStorage.setItem('offlineMessageQueue', JSON.stringify(offlineMessageQueue));
    }
}

window.addEventListener('online', processOfflineQueue);

// Update send message to handle offline
document.getElementById('send-message-btn').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input-text');
    const mediaInput = document.getElementById('chat-media-input-file');
    const currentClubId = localStorage.getItem('currentClubId');
    if (!chatInput || !currentClubId) {
        showNotification('Cannot send message. Missing input or club ID.', 'error');
        return;
    }
    const text = chatInput.value?.trim();
    const mediaFile = mediaInput?.files?.[0];
    if (!text && !mediaFile) {
        showNotification('Message or media is required.', 'error');
        return;
    }
    const replyTo = chatInput.dataset.replyTo;
    const message = {
        id: `msg-${Date.now()}`,
        senderId: currentUserId,
        sender: currentUsername,
        text: text || '',
        timestamp: new Date().toISOString(),
        replyTo: replyTo ? parseInt(replyTo) : null
    };

    if (mediaFile && validateFile(mediaFile)) {
        const reader = new FileReader();
        reader.onload = () => {
            if (mediaFile.type.includes('image/')) {
                message.image = reader.result;
            } else if (mediaFile.type.includes('video/')) {
                message.video = reader.result;
            }
            if (navigator.onLine && isSocketInitialized) {
                socketIO.emit('message', { clubId: currentClubId, message });
                saveMessage(currentClubId, message);
                renderChatMessages(currentClubId);
            } else {
                queueMessage(currentClubId, message);
                saveMessage(currentClubId, message);
                renderChatMessages(currentClubId);
                showNotification('Message queued. Will send when online.', 'success');
            }
            chatInput.value = '';
            mediaInput.value = '';
            delete chatInput.dataset.replyTo;
            cleanupDrafts();
        };
        reader.readAsDataURL(mediaFile);
    } else {
        if (navigator.onLine && isSocketInitialized) {
            socketIO.emit('message', { clubId: currentClubId, message });
            saveMessage(currentClubId, message);
            renderChatMessages(currentClubId);
        } else {
            queueMessage(currentClubId, message);
            saveMessage(currentClubId, message);
            renderChatMessages(currentClubId);
            showNotification('Message queued. Will send when online.', 'success');
        }
        chatInput.value = '';
        delete chatInput.dataset.replyTo;
        cleanupDrafts();
    }
});

// Handle club categories
function manageCategories() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to manage categories.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'categories-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Categories - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('categories-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="new-category">Add New Category</label>
                    <input type="text" id="new-category" placeholder="Enter category name">
                    <button class="neumorphic-btn" onclick="addCategory('${clubId}')">Add Category</button>
                </div>
                <h4>Current Categories:</h4>
                <ul id="category-list">
                    ${club.categories?.map(category => `
                        <li>
                            ${sanitizeInput(category)}
                            <button class="neumorphic-btn error" onclick="removeCategory('${clubId}', '${category}')">Remove</button>
                        </li>
                    `).join('') || '<p>No categories yet.</p>'}
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

function addCategory(clubId) {
    const input = document.getElementById('new-category');
    const category = input.value.trim();
    if (!category) {
        showNotification('Category name cannot be empty.', 'error');
        return;
    }

    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.categories = club.categories || [];
    if (!club.categories.includes(category)) {
        club.categories.push(category);
        safeExecute(async () => {
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ categories: club.categories })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            showNotification(`Category "${category}" added!`, 'success');
            manageCategories();
        }, 'Failed to add category.');
    } else {
        showNotification('Category already exists.', 'error');
    }
}

function removeCategory(clubId, category) {
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.categories = club.categories.filter(c => c !== category);
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ categories: club.categories })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(`Category "${category}" removed!`, 'success');
        manageCategories();
    }, 'Failed to remove category.');
}

// Add manage categories to dropdown
if (dropdownContent) {
    const categoriesOption = document.createElement('div');
    categoriesOption.textContent = 'Manage Categories';
    categoriesOption.onclick = manageCategories;
    dropdownContent.appendChild(categoriesOption);
}

// Update club info with categories
function updateClubInfo() {
    const currentClubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === currentClubId);
    const clubInfoSection = document.getElementById('club-info-section');
    if (club && clubInfoSection) {
        clubInfoSection.innerHTML = `
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)}" width="200" />
            <h2>${sanitizeInput(club.name)}</h2>
            <p>${sanitizeInput(club.description || 'No description provided.')}</p>
            <p>Type: ${sanitizeInput(club.type.charAt(0).toUpperCase() + club.type.slice(1))}</p>
            <p>Members: ${club.members.length}</p>
            <p>Online: ${club.online || 0}</p>
            <p>Created by: ${sanitizeInput(club.creator?.username || 'Unknown')}</p>
            <p class="membership-status">
                Status: ${club.members.includes(currentUserId) ? 'Member' : 'Not a Member'}
            </p>
            ${club.tags?.length ? `
                <p>Tags: ${club.tags.map(tag => `<span class="tag">${sanitizeInput(tag)}</span>`).join(' ')}</p>
            ` : ''}
            ${club.categories?.length ? `
                <p>Categories: ${club.categories.map(category => `<span class="category">${sanitizeInput(category)}</span>`).join(' ')}</p>
            ` : ''}
        `;
        displayEvents(currentClubId);
        displayPolls(currentClubId);
    }
}

// Add CSS for categories
style.textContent += `
    .category {
        background: var(--secondary-color);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        margin-right: 5px;
        font-size: 12px;
    }
`;

// Handle message categories
function addMessageCategory(clubId, messageIndex, category) {
    if (!messageData[clubId]?.[messageIndex]) return;
    messageData[clubId][messageIndex].categories = messageData[clubId][messageIndex].categories || [];
    if (!messageData[clubId][messageIndex].categories.includes(category)) {
        messageData[clubId][messageIndex].categories.push(category);
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (isSocketInitialized) {
            socketIO.emit('messageCategory', { clubId, messageIndex, category });
        }
        renderChatMessages(clubId);
        showNotification(`Category "${category}" added to message.`, 'success');
    }
}

// Socket.IO message category
if (isSocketInitialized) {
    socketIO.on('messageCategory', ({ clubId, messageIndex, category }) => {
        if (messageData[clubId]?.[messageIndex]) {
            messageData[clubId][messageIndex].categories = messageData[clubId][messageIndex].categories || [];
            if (!messageData[clubId][messageIndex].categories.includes(category)) {
                messageData[clubId][messageIndex].categories.push(category);
                localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
                if (clubId === localStorage.getItem('currentClubId')) {
                    renderChatMessages(clubId);
                }
            }
        }
    });
}

// Add category to message menu
function addCategoryMenu(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-message-id="${messageIndex}"]`);
    if (!messageEl) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const club = clubData.find(c => c.id === clubId);
        if (club?.categories?.length) {
            const categoryDiv = document.createElement('div');
            categoryDiv.textContent = 'Add Category';
            const categorySubmenu = document.createElement('div');
            categorySubmenu.className = 'submenu';
            club.categories.forEach(category => {
                const option = document.createElement('div');
                option.textContent = category;
                option.onclick = () => addMessageCategory(clubId, messageIndex, category);
                categorySubmenu.appendChild(option);
            });
            categoryDiv.appendChild(categorySubmenu);
            menuContent.appendChild(categoryDiv);
        }
    }
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((_, index) => {
        addCategoryMenu(clubId, index);
    });
});

// Add CSS for submenu
style.textContent += `
    .submenu {
        display: none;
        position: absolute;
        background: var(--bg-color);
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        min-width: 100px;
    }
    .message-menu-content div:hover .submenu {
        display: block;
    }
    .submenu div {
        padding: 8px;
        cursor: pointer;
    }
    .submenu div:hover {
        background: var(--table-highlight);
    }
`;

// Update renderChatMessages for message categories
function renderChatMessages(clubId, messages = null) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messages || messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        const readBy = msg.readBy?.length ? `Read by ${msg.readBy.length} user(s)` : '';
        const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        const text = parseMentions(sanitizeInput(msg.text));
        const replyTo = msg.replyTo !== null && messageData[clubId][msg.replyTo]
            ? `<div class="reply-preview" onclick="highlightMessage(${msg.replyTo})">
                <span>${sanitizeInput(messageData[clubId][msg.replyTo].sender)}:</span>
                ${sanitizeInput(messageData[clubId][msg.replyTo].text.slice(0, 50)) + '...'}
               </div>`
            : '';
        const categories = msg.categories?.length
            ? `<div class="message-categories">${msg.categories.map(c => `<span class="category">${sanitizeInput(c)}</span>`).join(' ')}</div>`
            : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''} ${msg.isEdited ? 'edited' : ''}" data-message-id="${i}" onclick="markMessageRead('${clubId}', ${i})">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                ${replyTo}
                <p>${text}${msg.isEdited ? ' <span class="edited-label">(edited)</span>' : ''}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${categories}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${readBy ? `<div class="read-receipt">${readBy}</div>` : ''}
                ${timestamp ? `<div class="timestamp">${timestamp}</div>` : ''}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                <div class="message-menu-content">
                    ${msg.senderId === currentUserId ? `
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                        <div onclick="pinMessage('${clubId}', ${i})">${msg.pinned ? 'Unpin' : 'Pin'}</div>
                        <div onclick="replyToMessage('${clubId}', ${i})">Reply</div>
                        <div onclick="forwardMessage('${clubId}', ${i})">Forward</div>
                        ${msg.isEdited ? `<div onclick="viewEditHistory('${clubId}', ${i})">View Edit History</div>` : ''}
                    ` : `
                        <div onclick="replyToMessage('${clubId}', ${i})">Reply</div>
                        <div onclick="addReaction('${clubId}', ${i}, '👍')">Add Reaction</div>
                    `}
                    ${(clubData.find(c => c.id === clubId)?.moderators.includes(currentUserId) || clubData.find(c => c.id === clubId)?.creator.id === currentUserId) ? `
                        <div onclick="deleteMessageForAll('${clubId}', ${i})">Delete for All</div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Add CSS for message categories and edited label
style.textContent += `
    .message-categories {
        margin-top: 5px;
    }
    .edited-label {
        font-size: 10px;
        color: var(--text-muted);
        margin-left: 5px;
    }
    .chat-message.edited p {
        position: relative;
    }
`;

// Handle message search by category
function searchMessagesByCategory(category) {
    const currentClubId = localStorage.getItem('currentClubId');
    if (!messageData[currentClubId]) return;

    const filteredMessages = messageData[currentClubId].filter(msg =>
        msg.categories?.includes(category)
    );
    renderChatMessages(currentClubId, filteredMessages);
}

// Add category filter to chat section
const categoryFilter = document.createElement('select');
categoryFilter.className = 'neumorphic-btn';
categoryFilter.innerHTML = '<option value="">All Messages</option>';
document.querySelector('.chat-section').prepend(categoryFilter);

function updateCategoryFilter() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (club?.categories) {
        categoryFilter.innerHTML = '<option value="">All Messages</option>' + club.categories.map(c =>
            `<option value="${sanitizeInput(c)}">${sanitizeInput(c)}</option>`
        ).join('');
    }
}

categoryFilter.addEventListener('change', (e) => {
    if (e.target.value) {
        searchMessagesByCategory(e.target.value);
    } else {
        renderChatMessages(localStorage.getItem('currentClubId'));
    }
});

document.addEventListener('clubSelected', updateCategoryFilter);

// Handle message bookmarks
function bookmarkMessage(clubId, messageIndex) {
    userData.bookmarks = userData.bookmarks || [];
    const bookmark = { clubId, messageIndex };
    const bookmarkKey = `${clubId}:${messageIndex}`;
    if (!userData.bookmarks.some(b => `${b.clubId}:${b.messageIndex}` === bookmarkKey)) {
        userData.bookmarks.push(bookmark);
        localStorage.setItem(`user_${currentUserId}`, JSON.stringify(userData));
        if (isSocketInitialized) {
            socketIO.emit('bookmarkMessage', { clubId, messageIndex, userId: currentUserId });
        }
        showNotification('Message bookmarked!', 'success');
    } else {
        userData.bookmarks = userData.bookmarks.filter(b => `${b.clubId}:${b.messageIndex}` !== bookmarkKey);
        localStorage.setItem(`user_${currentUserId}`, JSON.stringify(userData));
        if (isSocketInitialized) {
            socketIO.emit('unbookmarkMessage', { clubId, messageIndex, userId: currentUserId });
        }
        showNotification('Message unbookmarked.', 'success');
    }
    renderChatMessages(clubId);
}

// Socket.IO bookmark handling
if (isSocketInitialized) {
    socketIO.on('bookmarkMessage', ({ clubId, messageIndex, userId }) => {
        if (userId === currentUserId) {
            if (clubId === localStorage.getItem('currentClubId')) {
                renderChatMessages(clubId);
            }
        }
    });

    socketIO.on('unbookmarkMessage', ({ clubId, messageIndex, userId }) => {
        if (userId === currentUserId) {
            if (clubId === localStorage.getItem('currentClubId')) {
                renderChatMessages(clubId);
            }
        }
    });
}

// Add bookmark to message menu
function addBookmarkMenu(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-message-id="${messageIndex}"]`);
    if (!messageEl) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const bookmarkDiv = document.createElement('div');
        const isBookmarked = userData.bookmarks?.some(b => b.clubId === clubId && b.messageIndex === messageIndex);
        bookmarkDiv.textContent = isBookmarked ? 'Remove Bookmark' : 'Bookmark';
        bookmarkDiv.onclick = () => bookmarkMessage(clubId, messageIndex);
        menuContent.appendChild(bookmarkDiv);
    }
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((_, index) => {
        addBookmarkMenu(clubId, index);
    });
});

// View bookmarked messages
function viewBookmarks() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'bookmarks-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Bookmarked Messages</h3>
                <button class="neumorphic-btn" onclick="closeModal('bookmarks-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                ${userData.bookmarks?.length ? userData.bookmarks.map(b => {
                    const message = messageData[b.clubId]?.[b.messageIndex];
                    const club = clubData.find(c => c.id === b.clubId);
                    if (message && club) {
                        return `
                            <div class="bookmark-item" onclick="goToMessage('${b.clubId}', ${b.messageIndex})">
                                <p><strong>${sanitizeInput(club.name)}</strong>: ${sanitizeInput(message.text.slice(0, 50))}...</p>
                                <p>${formatTimestamp(message.timestamp)}</p>
                            </div>
                        `;
                    }
                    return '';
                }).join('') : '<p>No bookmarked messages.</p>'}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

function goToMessage(clubId, messageIndex) {
    selectClub(clubId);
    setTimeout(() => {
        highlightMessage(messageIndex);
    }, 500); // Wait for club to load
}

// Add view bookmarks to dropdown
if (dropdownContent) {
    const bookmarksOption = document.createElement('div');
    bookmarksOption.textContent = 'View Bookmarks';
    bookmarksOption.onclick = viewBookmarks;
    dropdownContent.appendChild(bookmarksOption);
}

// Handle message reactions (multiple reaction types)
function addReaction(clubId, messageIndex, reaction) {
    if (!messageData[clubId]?.[messageIndex]) return;
    messageData[clubId][messageIndex].reactions = messageData[clubId][messageIndex].reactions || {};
    messageData[clubId][messageIndex].reactions[reaction] = (messageData[clubId][messageIndex].reactions[reaction] || 0) + 1;
    localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
    if (isSocketInitialized) {
        socketIO.emit('reaction', { clubId, messageIndex, reaction });
    }
    renderChatMessages(clubId);
}

// Add reaction picker to message menu
function addReactionPicker(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-message-id="${messageIndex}"]`);
    if (!messageEl) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const reactionDiv = document.createElement('div');
        reactionDiv.textContent = 'Add Reaction';
        const reactionSubmenu = document.createElement('div');
        reactionSubmenu.className = 'submenu';
        const reactions = ['👍', '❤️', '😂', '😢', '😮'];
        reactions.forEach(r => {
            const option = document.createElement('div');
            option.textContent = r;
            option.onclick = () => addReaction(clubId, messageIndex, r);
            reactionSubmenu.appendChild(option);
        });
        reactionDiv.appendChild(reactionSubmenu);
        menuContent.appendChild(reactionDiv);
    }
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((_, index) => {
        addReactionPicker(clubId, index);
    });
});

// Handle message threads
function openThread(clubId, messageIndex) {
    const message = messageData[clubId]?.[messageIndex];
    if (!message) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'thread-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Thread: ${sanitizeInput(message.text.slice(0, 30))}...</h3>
                <button class="neumorphic-btn" onclick="closeModal('thread-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <div id="thread-messages"></div>
                <div class="thread-input">
                    <input type="text" id="thread-input-text" placeholder="Reply in thread...">
                    <button class="neumorphic-btn" onclick="sendThreadMessage('${clubId}', ${messageIndex})">Send</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    renderThreadMessages(clubId, messageIndex);
}

function renderThreadMessages(clubId, messageIndex) {
    const threadMessagesEl = document.getElementById('thread-messages');
    if (!threadMessagesEl) return;

    messageData[clubId][messageIndex].thread = messageData[clubId][messageIndex].thread || [];
    const threadMessages = messageData[clubId][messageIndex].thread;

    threadMessagesEl.innerHTML = threadMessages.map((msg, i) => `
        <div class="thread-message">
            <span class="sender">${sanitizeInput(msg.sender)}</span>
            <p>${parseMentions(sanitizeInput(msg.text))}</p>
            <div class="timestamp">${formatTimestamp(msg.timestamp)}</div>
        </div>
    `).join('');
    threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;
}

function sendThreadMessage(clubId, messageIndex) {
    const input = document.getElementById('thread-input-text');
    const text = input.value.trim();
    if (!text) return;

    const threadMessage = {
        id: `thread-msg-${Date.now()}`,
        senderId: currentUserId,
        sender: currentUsername,
        text,
        timestamp: new Date().toISOString()
    };

    messageData[clubId][messageIndex].thread = messageData[clubId][messageIndex].thread || [];
    messageData[clubId][messageIndex].thread.push(threadMessage);
    localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
    if (isSocketInitialized) {
        socketIO.emit('threadMessage', { clubId, messageIndex, threadMessage });
    }
    renderThreadMessages(clubId, messageIndex);
    input.value = '';
}

if (isSocketInitialized) {
    socketIO.on('threadMessage', ({ clubId, messageIndex, threadMessage }) => {
        if (messageData[clubId]?.[messageIndex]) {
            messageData[clubId][messageIndex].thread = messageData[clubId][messageIndex].thread || [];
            messageData[clubId][messageIndex].thread.push(threadMessage);
            localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
            if (document.getElementById('thread-modal') && clubId === localStorage.getItem('currentClubId')) {
                renderThreadMessages(clubId, messageIndex);
            }
        }
    });
}

// Add thread to message menu
function addThreadMenu(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-message-id="${messageIndex}"]`);
    if (!messageEl) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const threadDiv = document.createElement('div');
        threadDiv.textContent = 'Open Thread';
        threadDiv.onclick = () => openThread(clubId, messageIndex);
        menuContent.appendChild(threadDiv);
    }
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((_, index) => {
        addThreadMenu(clubId, index);
    });
});

// Add CSS for threads
style.textContent += `
    .thread-message {
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
    }
    .thread-input {
        display: flex;
        margin-top: 10px;
    }
    .thread-input input {
        flex: 1;
        margin-right: 10px;
    }
`;

// Handle message attachments
function addAttachment(clubId, messageIndex, file) {
    if (!messageData[clubId]?.[messageIndex] || !validateFile(file, 10)) return;

    const reader = new FileReader();
    reader.onload = () => {
        messageData[clubId][messageIndex].attachments = messageData[clubId][messageIndex].attachments || [];
        messageData[clubId][messageIndex].attachments.push({
            name: file.name,
            data: reader.result,
            type: file.type
        });
        localStorage.setItem(`chat_${clubId}`, JSON.stringify(messageData[clubId]));
        if (isSocketInitialized) {
            socketIO.emit('attachment', { clubId, messageIndex, attachment: { name: file.name, type: file.type } });
        }
        renderChatMessages(clubId);
        showNotification('Attachment added!', 'success');
    };
    reader.readAsDataURL(file);
}

// Update renderChatMessages for attachments
function renderChatMessages(clubId, messages = null) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    messageData[clubId] = JSON.parse(localStorage.getItem(`chat_${clubId}`)) || [];
    const clubMessages = messages || messageData[clubId];
    if (clubMessages.length === 0) {
        messagesEl.innerHTML = `<p class="text-center">No messages yet.</p>`;
        return;
    }

    const pinnedMessages = clubMessages.filter(msg => msg.pinned);
    const regularMessages = clubMessages.filter(msg => !msg.pinned);
    const sortedMessages = [...pinnedMessages, ...regularMessages];

    messagesEl.innerHTML = sortedMessages.map((msg, i) => {
        const reactions = msg.reactions
            ? Object.entries(msg.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ')
            : '';
        const readBy = msg.readBy?.length ? `Read by ${msg.readBy.length} user(s)` : '';
        const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        const text = parseMentions(sanitizeInput(msg.text));
        const replyTo = msg.replyTo !== null && messageData[clubId][msg.replyTo]
            ? `<div class="reply-preview" onclick="highlightMessage(${msg.replyTo})">
                <span>${sanitizeInput(messageData[clubId][msg.replyTo].sender)}:</span>
                ${sanitizeInput(messageData[clubId][msg.replyTo].text.slice(0, 50)) + '...'}
               </div>`
            : '';
        const categories = msg.categories?.length
            ? `<div class="message-categories">${msg.categories.map(c => `<span class="category">${sanitizeInput(c)}</span>`).join(' ')}</div>`
            : '';
        const attachments = msg.attachments?.length
            ? `<div class="attachments">${msg.attachments.map(a => `
                <a href="${sanitizeInput(a.data)}" download="${sanitizeInput(a.name)}">${sanitizeInput(a.name)}</a>
            `).join('')}</div>`
            : '';
        const threadCount = msg.thread?.length ? `<span class="thread-count">Thread (${msg.thread.length})</span>` : '';
        return `
            <div class="chat-message ${msg.senderId === currentUserId ? 'own' : ''} ${msg.pinned ? 'pinned' : ''} ${msg.isEdited ? 'edited' : ''} ${userData.bookmarks?.some(b => b.clubId === clubId && b.messageIndex === i) ? 'bookmarked' : ''}" data-message-id="${i}" onclick="markMessageRead('${clubId}', ${i})">
                <span class="sender">${sanitizeInput(msg.sender)}</span>
                ${replyTo}
                <p>${text}${msg.isEdited ? ' <span class="edited-label">(edited)</span>' : ''}</p>
                ${msg.image ? `<img src="${sanitizeInput(msg.image)}" alt="Image">` : ''}
                ${msg.video ? `<video src="${sanitizeInput(msg.video)}" controls></video>` : ''}
                ${categories}
                ${attachments}
                ${reactions ? `<div class="reactions">${reactions}</div>` : ''}
                ${readBy ? `<div class="read-receipt">${readBy}</div>` : ''}
                ${timestamp ? `<div class="timestamp">${timestamp}</div>` : ''}
                ${threadCount}
                ${msg.pinned ? `<span class="pinned-icon"><i class="fas fa-thumbtack"></i></span>` : ''}
                ${userData.bookmarks?.some(b => b.clubId === clubId && b.messageIndex === i) ? `<span class="bookmark-icon"><i class="fas fa-bookmark"></i></span>` : ''}
                <span class="message-menu"><i class="fas fa-ellipsis-v"></i></span>
                <div class="message-menu-content">
                    ${msg.senderId === currentUserId ? `
                        <div onclick="editMessage('${clubId}', ${i})">Edit</div>
                        <div onclick="deleteMessage('${clubId}', ${i})">Delete</div>
                        <div onclick="replyToMessage('${clubId}', ${i})">Reply</div>
                        <div onclick="forwardMessage('${clubId}', ${i})">Forward</div>
                        ${msg.isEdited ? `<div onclick="viewEditHistory('${clubId}', ${i})">View Edit History</div>` : ''}
                    ` : `
                        <div onclick="replyToMessage('${clubId}', ${i})">Reply</div>
                    `}
                    <div onclick="bookmarkMessage('${clubId}', ${i})">${userData.bookmarks?.some(b => b.clubId === clubId && b.messageIndex === i) ? 'Remove Bookmark' : 'Bookmark'}</div>
                    <div onclick="openThread('${clubId}', ${i})">Open Thread</div>
                    ${(clubData.find(c => c.id === clubId)?.moderators.includes(currentUserId) || clubData.find(c => c.id === clubId)?.creator.id === currentUserId) ? `
                        <div onclick="deleteMessageForAll('${clubId}', ${i})">Delete for All</div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.querySelectorAll('.message-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuContent = e.target.nextElementSibling;
            document.querySelectorAll('.message-menu-content.active').forEach(content => {
                if (content !== menuContent) content.classList.remove('active');
            });
            if (menuContent) menuContent.classList.toggle('active');
        });
    });

    document.dispatchEvent(new Event('messagesRendered'));
}

// Add CSS for attachments, bookmarks, and threads
style.textContent += `
    .attachments {
        margin-top: 10px;
    }
    .attachments a {
        display: block;
        color: var(--accent-color);
        text-decoration: none;
    }
    .attachments a:hover {
        text-decoration: underline;
    }
    .bookmark-icon {
        position: absolute;
        top: 5px;
        right: 5px;
        color: var(--accent-color);
    }
    .chat-message.bookmarked {
        background: var(--table-highlight);
    }
    .thread-count {
        font-size: 12px;
        color: var(--accent-color);
        cursor: pointer;
        margin-top: 5px;
    }
    .thread-count:hover {
        text-decoration: underline;
    }
`;

// Handle attachment upload in message menu
function addAttachmentMenu(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-message-id="${messageIndex}"]`);
    if (!messageEl || messageData[clubId][messageIndex].senderId !== currentUserId) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const attachmentDiv = document.createElement('div');
        attachmentDiv.textContent = 'Add Attachment';
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.onchange = (e) => {
            if (e.target.files[0]) {
                addAttachment(clubId, messageIndex, e.target.files[0]);
            }
        };
        attachmentDiv.onclick = () => input.click();
        menuContent.appendChild(attachmentDiv);
        menuContent.appendChild(input);
    }
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((_, index) => {
        addAttachmentMenu(clubId, index);
    });
});

// Handle message report
function reportMessage(clubId, messageIndex) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'report-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Report Message</h3>
                <button class="neumorphic-btn" onclick="closeModal('report-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="report-form">
                    <div class="form-group">
                        <label for="report-reason">Reason for Report</label>
                        <textarea id="report-reason" name="reason" required></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('report-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Submit Report</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('report-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = document.getElementById('report-reason').value.trim();

        await safeExecute(async () => {
            await apiRequest(`/api/clubs/${clubId}/messages/${messageIndex}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason, reporterId: currentUserId })
            });
            showNotification('Message reported successfully.', 'success');
            modal.remove();
            overlay.remove();
        }, 'Failed to report message.');
    });
}

// Add report to message menu
function addReportMenu(clubId, messageIndex) {
    const messageEl = document.querySelector(`.chat-message[data-messageId="${messageIndex}"]`);
    if (!messageEl || messageData[clubId][messageIndex].senderId === currentUserId) return;

    const menuContent = messageEl.querySelector('.message-menu-content');
    if (menuContent) {
        const reportDiv = document.createElement('div');
        reportDiv.textContent = 'Report';
        reportDiv.onclick = () => reportMessage(clubId, messageIndex);
        menuContent.appendChild(reportDiv);
    }
}

document.addEventListener('messagesRendered', () => {
    const clubId = localStorage.getItem('currentClubId');
    messageData[clubId]?.forEach((_, index) => {
        addReportMenu(clubId, index);
    });
});

// Handle club rules
function manageRules() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to manage rules.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'rules-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Rules - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('rules-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="new-rule">Add New Rule</label>
                    <input type="text" id="new-rule" placeholder="Enter rule...">
                    <button class="neumorphic-btn" onclick="addRule('${clubId}')">Add Rule</button>
                </div>
                <h4>Current Rules:</h4>
                <ul id="rule-list">
                    ${club.rules?.map((rule, index) => `
                        <li>
                            ${sanitizeInput(rule)}
                            <button class="neumorphic-btn error" onclick="removeRule('${clubId}', ${index})">Remove</button>
                        </li>
                    `).join('') || '<p>No rules yet.</p>'}
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
}

function addRule(clubId) {
    const rule = document.getElementById('new-rule').value.trim();
    if (!rule) {
        showNotification('Rule cannot be empty.', 'error');
        return;
    }

    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.rules = club.rules || [];
    club.rules.push(rule);
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ rules: club.rules })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(`Rule added successfully!`, 'success');
        manageRules();
    }, 'Failed to add rule.');
}

function removeRule(clubId, ruleIndex) {
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    club.rules.splice(ruleIndex, 1);
    safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ rules: club.rules })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        showNotification(`Rule removed successfully!`, 'success');
        manageRules();
    }, 'Failed to remove rule.');
}

// Add manage rules to dropdown
if (dropdownContent) {
    const rulesOption = document.createElement('div');
    rulesOption.textContent = 'Manage Rules';
    rulesOption.onclick = manageRules;
    dropdownContent.appendChild(rulesOption);
}

// Update club info with rules
function updateClubInfo() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    const clubInfoSection = document.getElementById('club-info-section');
    if (club && clubInfoSection) {
               clubInfoSection.innerHTML = `
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)}" width="200" />
            <h2>${sanitizeInput(club.name)}</h2>
            <p>${sanitizeInput(club.description || 'No description provided.')}</p>
            <p>Type: ${sanitizeInput(club.type.charAt(0).toUpperCase() + club.type.slice(1))}</p>
            <p>Members: ${club.members.length}</p>
            <p>Online: ${club.online || 0}</p>
            <p>Created by: ${sanitizeInput(club.creator?.username || 'Unknown')}</p>
            <p class="membership-status">
                Status: ${club.members.includes(currentUserId) ? 'Member' : 'Not a Member'}
            </p>
            ${club.tags?.length ? `
                <p>Tags: ${club.tags.map(tag => `<span class="tag">${sanitizeInput(tag)}</span>`).join(' ')}</p>
            ` : ''}
            ${club.categories?.length ? `
                <p>Categories: ${club.categories.map(category => `<span class="category">${sanitizeInput(category)}</span>`).join(' ')}</p>
            ` : ''}
            ${club.rules?.length ? `
                <p>Rules:</p>
                <ul class="club-rules">
                    ${club.rules.map(rule => `<li>${sanitizeInput(rule)}</li>`).join('')}
                </ul>
            ` : ''}
        `;
        displayEvents(clubId);
        displayPolls(clubId);
    }
}

// Add CSS for club rules
style.textContent += `
    .club-rules {
        list-style-type: disc;
        margin-left: 20px;
        margin-top: 10px;
    }
    .club-rules li {
        margin-bottom: 5px;
    }
`;

// Handle club invites
function inviteToClub() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'invite-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Invite to ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('invite-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="invite-form">
                    <div class="form-group">
                        <label for="invite-username">Username</label>
                        <input type="text" id="invite-username" name="username" required>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('invite-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Send Invite</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('invite-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('invite-username').value.trim();

        await safeExecute(async () => {
            const user = await apiRequest(`/api/users?username=${encodeURIComponent(username)}`);
            if (!user || !user.id) {
                showNotification('User not found.', 'error');
                return;
            }
            if (club.members.includes(user.id)) {
                showNotification('User is already a member.', 'error');
                return;
            }
            const invite = {
                id: `invite-${Date.now()}`,
                clubId,
                userId: user.id,
                senderId: currentUserId,
                timestamp: new Date().toISOString()
            };
            await apiRequest(`/api/clubs/${clubId}/invites`, {
                method: 'POST',
                body: JSON.stringify(invite)
            });
            if (isSocketInitialized) {
                socketIO.emit('clubInvite', { clubId, userId: user.id, invite });
            }
            showNotification(`Invite sent to ${username}!`, 'success');
            modal.remove();
            overlay.remove();
        }, 'Failed to send invite.');
    });
}

// Add invite to dropdown
if (dropdownContent) {
    const inviteOption = document.createElement('div');
    inviteOption.textContent = 'Invite to Club';
    inviteOption.onclick = inviteToClub;
    dropdownContent.appendChild(inviteOption);
}

// Socket.IO club invite
if (isSocketInitialized) {
    socketIO.on('clubInvite', ({ clubId, userId, invite }) => {
        if (userId === currentUserId) {
            showBrowserNotification('New Club Invite', `You have been invited to join ${clubData.find(c => c.id === clubId)?.name || 'a club'}!`);
        }
    });
}

// Handle club invite acceptance
async function acceptInvite(inviteId) {
    await safeExecute(async () => {
        const invite = await apiRequest(`/api/invites/${inviteId}`);
        if (!invite || invite.userId !== currentUserId) {
            showNotification('Invalid invite.', 'error');
            return;
        }
        const club = clubData.find(c => c.id === invite.clubId);
        if (!club) {
            showNotification('Club not found.', 'error');
            return;
        }
        club.members.push(currentUserId);
        await apiRequest(`/api/clubs/${invite.clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ members: club.members })
        });
        await apiRequest(`/api/invites/${inviteId}`, {
            method: 'DELETE'
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        if (isSocketInitialized) {
            socketIO.emit('joinClub', { clubId: invite.clubId, userId: currentUserId });
        }
        showNotification(`You have joined ${club.name}!`, 'success');
        renderClubLists();
    }, 'Failed to accept invite.');
}

// Handle club invite rejection
async function rejectInvite(inviteId) {
    await safeExecute(async () => {
        await apiRequest(`/api/invites/${inviteId}`, {
            method: 'DELETE'
        });
        showNotification('Invite rejected.', 'success');
    }, 'Failed to reject invite.');
}

// Display club invites
async function viewInvites() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'invites-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Club Invites</h3>
                <button class="neumorphic-btn" onclick="closeModal('invites-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <div id="invite-list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    await safeExecute(async () => {
        const invites = await apiRequest(`/api/invites?userId=${currentUserId}`);
        const inviteList = document.getElementById('invite-list');
        if (invites.length > 0) {
            inviteList.innerHTML = invites.map(invite => {
                const club = clubData.find(c => c.id === invite.clubId);
                return club ? `
                    <div class="invite-item">
                        <p><strong>${sanitizeInput(club.name)}</strong> invited you!</p>
                        <p>Sent by: ${sanitizeInput(invite.senderId)}</p>
                        <p>${formatTimestamp(invite.timestamp)}</p>
                        <button class="neumorphic-btn primary" onclick="acceptInvite('${invite.id}')">Accept</button>
                        <button class="neumorphic-btn error" onclick="rejectInvite('${invite.id}')">Reject</button>
                    </div>
                ` : '';
            }).join('');
        } else {
            inviteList.innerHTML = '<p>No pending invites.</p>';
        }
    }, 'Failed to load invites.');
}

// Add view invites to dropdown
if (dropdownContent) {
    const invitesOption = document.createElement('div');
    invitesOption.textContent = 'View Invites';
    invitesOption.onclick = viewInvites;
    dropdownContent.appendChild(invitesOption);
}

// Add CSS for invites
style.textContent += `
    .invite-item {
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 10px;
    }
    .invite-item button {
        margin-right: 10px;
    }
`;

// Handle club announcements
function createAnnouncement() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to create announcements.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'announcement-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create Announcement - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('announcement-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="announcement-form">
                    <div class="form-group">
                        <label for="announcement-text">Announcement</label>
                        <textarea id="announcement-text" name="text" required></textarea>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('announcement-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Post</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('announcement-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('announcement-text').value.trim();
        if (!text) {
            showNotification('Announcement cannot be empty.', 'error');
            return;
        }

        const announcement = {
            id: `announcement-${Date.now()}`,
            clubId,
            creatorId: currentUserId,
            text,
            timestamp: new Date().toISOString()
        };

        await safeExecute(async () => {
            await apiRequest(`/api/clubs/${clubId}/announcements`, {
                method: 'POST',
                body: JSON.stringify(announcement)
            });
            if (isSocketInitialized) {
                socketIO.emit('announcement', { clubId, announcement });
            }
            showNotification('Announcement posted!', 'success');
            modal.remove();
            overlay.remove();
            displayAnnouncements(clubId);
        }, 'Failed to post announcement.');
    });
}

function displayAnnouncements(clubId) {
    const clubInfoSection = document.getElementById('club-info-section');
    if (!clubInfoSection) return;

    safeExecute(async () => {
        const announcements = await apiRequest(`/api/clubs/${clubId}/announcements`);
        const announcementsDiv = document.createElement('div');
        announcementsDiv.className = 'club-announcements';
        announcementsDiv.innerHTML = '<h4>Announcements</h4>';
        if (announcements.length > 0) {
            announcementsDiv.innerHTML += announcements.map(ann => `
                <div class="announcement-item">
                    <p>${sanitizeInput(ann.text)}</p>
                    <p class="timestamp">${formatTimestamp(ann.timestamp)}</p>
                    <p>Posted by: ${sanitizeInput(userData[ann.creatorId]?.username || 'Unknown')}</p>
                </div>
            `).join('');
        } else {
            announcementsDiv.innerHTML += '<p>No announcements.</p>';
        }
        clubInfoSection.appendChild(announcementsDiv);
    }, 'Failed to load announcements.');
}

// Socket.IO announcement
if (isSocketInitialized) {
    socketIO.on('announcement', ({ clubId, announcement }) => {
        if (clubId === localStorage.getItem('currentClubId')) {
            displayAnnouncements(clubId);
        }
        const club = clubData.find(c => c.id === clubId);
        if (club && !club.muted) {
            showBrowserNotification(`New Announcement in ${club.name}`, announcement.text);
        }
    });
}

// Add create announcement to dropdown
if (dropdownContent) {
    const announcementOption = document.createElement('div');
    announcementOption.textContent = 'Create Announcement';
    announcementOption.onclick = createAnnouncement;
    dropdownContent.appendChild(announcementOption);
}

// Add CSS for announcements
style.textContent += `
    .club-announcements {
        margin-top: 20px;
    }
    .announcement-item {
        background: var(--table-highlight);
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 10px;
    }
    .announcement-item .timestamp {
        font-size: 12px;
        color: var(--text-muted);
    }
`;

// Handle club member management
function manageMembers() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to manage members.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'members-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Members - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('members-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <h4>Members:</h4>
                <ul id="member-list"></ul>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    safeExecute(async () => {
        const members = await apiRequest(`/api/clubs/${clubId}/members`);
        const memberList = document.getElementById('member-list');
        memberList.innerHTML = members.map(member => `
            <li>
                ${sanitizeInput(member.username)}
                ${member.id === club.creator.id ? ' (Creator)' : ''}
                ${club.moderators.includes(member.id) ? ' (Moderator)' : ''}
                ${member.id !== club.creator.id ? `
                    <button class="neumorphic-btn error" onclick="kickMember('${clubId}', '${member.id}')">Kick</button>
                    ${club.moderators.includes(member.id) ? `
                        <button class="neumorphic-btn" onclick="removeModerator('${clubId}', '${member.id}')">Remove Moderator</button>
                    ` : `
                        <button class="neumorphic-btn" onclick="addModerator('${clubId}', '${member.id}')">Make Moderator</button>
                    `}
                ` : ''}
            </li>
        `).join('');
    }, 'Failed to load members.');
}

function kickMember(clubId, userId) {
    if (confirm('Are you sure you want to kick this member?')) {
        safeExecute(async () => {
            const club = clubData.find(c => c.id === clubId);
            club.members = club.members.filter(m => m !== userId);
            club.moderators = club.moderators.filter(m => m !== userId);
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ members: club.members, moderators: club.moderators })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            if (isSocketInitialized) {
                socketIO.emit('kickMember', { clubId, userId });
            }
            showNotification('Member kicked.', 'success');
            manageMembers();
        }, 'Failed to kick member.');
    }
}

function addModerator(clubId, userId) {
    safeExecute(async () => {
        const club = clubData.find(c => c.id === clubId);
        if (!club.moderators.includes(userId)) {
            club.moderators.push(userId);
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ moderators: club.moderators })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            if (isSocketInitialized) {
                socketIO.emit('addModerator', { clubId, userId });
            }
            showNotification('Member promoted to moderator.', 'success');
            manageMembers();
        }
    }, 'Failed to add moderator.');
}

function removeModerator(clubId, userId) {
    safeExecute(async () => {
        const club = clubData.find(c => c.id === clubId);
        club.moderators = club.moderators.filter(m => m !== userId);
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ moderators: club.moderators })
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        if (isSocketInitialized) {
            socketIO.emit('removeModerator', { clubId, userId });
        }
        showNotification('Moderator status removed.', 'success');
        manageMembers();
    }, 'Failed to remove moderator.');
}

// Socket.IO member management
if (isSocketInitialized) {
    socketIO.on('kickMember', ({ clubId, userId }) => {
        if (userId === currentUserId) {
            showNotification('You have been kicked from the club.', 'error');
            localStorage.removeItem('currentClubId');
            renderClubLists();
        }
    });

    socketIO.on('addModerator', ({ clubId, userId }) => {
        if (userId === currentUserId) {
            showNotification('You have been promoted to moderator!', 'success');
        }
    });

    socketIO.on('removeModerator', ({ clubId, userId }) => {
        if (userId === currentUserId) {
            showNotification('Your moderator status has been removed.', 'success');
        }
    });
}

// Add manage members to dropdown
if (dropdownContent) {
    const membersOption = document.createElement('div');
    membersOption.textContent = 'Manage Members';
    membersOption.onclick = manageMembers;
    dropdownContent.appendChild(membersOption);
}

// Add CSS for member management
style.textContent += `
    #member-list li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-color);
    }
    #member-list button {
        margin-left: 10px;
    }
`;

// Handle club visibility settings
function manageVisibility() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || club.creator.id !== currentUserId) {
        showNotification('Only the club creator can manage visibility.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'visibility-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Visibility - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('visibility-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="visibility-form">
                    <div class="form-group">
                        <label for="visibility">Club Visibility</label>
                        <select id="visibility" name="visibility">
                            <option value="public" ${club.visibility === 'public' ? 'selected' : ''}>Public</option>
                            <option value="private" ${club.visibility === 'private' ? 'selected' : ''}>Private</option>
                            <option value="hidden" ${club.visibility === 'hidden' ? 'selected' : ''}>Hidden</option>
                        </select>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('visibility-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('visibility-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const visibility = document.getElementById('visibility').value;

        await safeExecute(async () => {
            club.visibility = visibility;
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ visibility })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            showNotification('Visibility updated!', 'success');
            modal.remove();
            overlay.remove();
        }, 'Failed to update visibility.');
    });
}

// Add manage visibility to dropdown
if (dropdownContent) {
    const visibilityOption = document.createElement('div');
    visibilityOption.textContent = 'Manage Visibility';
    visibilityOption.onclick = manageVisibility;
    dropdownContent.appendChild(visibilityOption);
}

// Update club info with visibility
function updateClubInfo() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    const clubInfoSection = document.getElementById('club-info-section');
    if (club && clubInfoSection) {
        clubInfoSection.innerHTML = `
            <img src="${sanitizeInput(club.image || '/assets/default-image.jpg')}" alt="${sanitizeInput(club.name)}" width="200" />
            <h2>${sanitizeInput(club.name)}</h2>
            <p>${sanitizeInput(club.description || 'No description provided.')}</p>
            <p>Type: ${sanitizeInput(club.type.charAt(0).toUpperCase() + club.type.slice(1))}</p>
            <p>Visibility: ${sanitizeInput(club.visibility.charAt(0).toUpperCase() + club.visibility.slice(1))}</p>
            <p>Members: ${club.members.length}</p>
            <p>Online: ${club.online || 0}</p>
            <p>Created by: ${sanitizeInput(club.creator?.username || 'Unknown')}</p>
            <p class="membership-status">
                Status: ${club.members.includes(currentUserId) ? 'Member' : 'Not a Member'}
            </p>
            ${club.tags?.length ? `
                <p>Tags: ${club.tags.map(tag => `<span class="tag">${sanitizeInput(tag)}</span>`).join(' ')}</p>
            ` : ''}
            ${club.categories?.length ? `
                <p>Categories: ${club.categories.map(category => `<span class="category">${sanitizeInput(category)}</span>`).join(' ')}</p>
            ` : ''}
            ${club.rules?.length ? `
                <p>Rules:</p>
                <ul class="club-rules">
                    ${club.rules.map(rule => `<li>${sanitizeInput(rule)}</li>`).join('')}
                </ul>
            ` : ''}
        `;
        displayEvents(clubId);
        displayPolls(clubId);
        displayAnnouncements(clubId);
    }
}

// Handle club join requests (for private clubs)
async function requestToJoinClub(clubId) {
    const club = clubData.find(c => c.id === clubId);
    if (!club || club.visibility !== 'private') {
        showNotification('This club is not private or does not exist.', 'error');
        return;
    }
    if (club.members.includes(currentUserId)) {
        showNotification('You are already a member.', 'error');
        return;
    }

    await safeExecute(async () => {
        const joinRequest = {
            id: `request-${Date.now()}`,
            clubId,
            userId: currentUserId,
            timestamp: new Date().toISOString()
        };
        await apiRequest(`/api/clubs/${clubId}/join-requests`, {
            method: 'POST',
            body: JSON.stringify(joinRequest)
        });
        if (isSocketInitialized) {
            socketIO.emit('joinRequest', { clubId, userId: currentUserId, joinRequest });
        }
        showNotification('Join request sent!', 'success');
    }, 'Failed to send join request.');
}

// Handle club join request management
function manageJoinRequests() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to manage join requests.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'join-requests-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Manage Join Requests - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('join-requests-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <div id="join-request-list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    safeExecute(async () => {
        const requests = await apiRequest(`/api/clubs/${clubId}/join-requests`);
        const requestList = document.getElementById('join-request-list');
        if (requests.length > 0) {
            requestList.innerHTML = requests.map(req => `
                <div class="join-request-item">
                    <p><strong>${sanitizeInput(userData[req.userId]?.username || 'Unknown')}</strong> requested to join.</p>
                    <p>${formatTimestamp(req.timestamp)}</p>
                    <button class="neumorphic-btn primary" onclick="acceptJoinRequest('${clubId}', '${req.id}')">Accept</button>
                    <button class="neumorphic-btn error" onclick="rejectJoinRequest('${clubId}', '${req.id}')">Reject</button>
                </div>
            `).join('');
        } else {
            requestList.innerHTML = '<p>No pending join requests.</p>';
        }
    }, 'Failed to load join requests.');
}

async function acceptJoinRequest(clubId, requestId) {
    await safeExecute(async () => {
        const request = await apiRequest(`/api/clubs/${clubId}/join-requests/${requestId}`);
        if (!request) {
            showNotification('Invalid request.', 'error');
            return;
        }
        const club = clubData.find(c => c.id === clubId);
        if (!club) return;
        club.members.push(request.userId);
        await apiRequest(`/api/clubs/${clubId}`, {
            method: 'PATCH',
            body: JSON.stringify({ members: club.members })
        });
        await apiRequest(`/api/clubs/${clubId}/join-requests/${requestId}`, {
            method: 'DELETE'
        });
        localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
        if (isSocketInitialized) {
            socketIO.emit('joinClub', { clubId, userId: request.userId });
        }
        showNotification('Join request accepted.', 'success');
        manageJoinRequests();
    }, 'Failed to accept join request.');
}

async function rejectJoinRequest(clubId, requestId) {
    await safeExecute(async () => {
        await apiRequest(`/api/clubs/${clubId}/join-requests/${requestId}`, {
            method: 'DELETE'
        });
        showNotification('Join request rejected.', 'success');
        manageJoinRequests();
    }, 'Failed to reject join request.');
}

// Socket.IO join request
if (isSocketInitialized) {
    socketIO.on('joinRequest', ({ clubId, userId, joinRequest }) => {
        const club = clubData.find(c => c.id === clubId);
        if (club && (club.moderators.includes(currentUserId) || club.creator.id === currentUserId)) {
            showBrowserNotification('New Join Request', `${userData[userId]?.username || 'Someone'} has requested to join ${club.name}.`);
        }
    });
}

// Add manage join requests to dropdown
if (dropdownContent) {
    const joinRequestsOption = document.createElement('div');
    joinRequestsOption.textContent = 'Manage Join Requests';
    joinRequestsOption.onclick = manageJoinRequests;
    dropdownContent.appendChild(joinRequestsOption);
}

// Add CSS for join requests
style.textContent += `
    .join-request-item {
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 10px;
    }
    .join-request-item button {
        margin-right: 10px;
    }
`;

// Handle club search with visibility
function searchClubs(query) {
    const filteredClubs = clubData.filter(club =>
        (club.visibility === 'public' || club.members.includes(currentUserId)) &&
        (club.name.toLowerCase().includes(query.toLowerCase()) ||
         club.description?.toLowerCase().includes(query.toLowerCase()) ||
         club.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
         club.categories?.some(category => category.toLowerCase().includes(query.toLowerCase())))
    );
    renderClubLists(filteredClubs);
}

// Handle club profile picture update
function updateClubProfilePicture() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || club.creator.id !== currentUserId) {
        showNotification('Only the club creator can update the profile picture.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'club-profile-pic-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Update Club Profile Picture - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('club-profile-pic-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="club-profile-pic-form">
                    <div class="form-group">
                        <label for="club-profile-pic">Profile Picture</label>
                        <input type="file" id="club-profile-pic" name="club-profile-pic" accept="image/*">
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('club-profile-pic-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Update</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

document.getElementById('club-profile-pic-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('club-profile-pic').files[0];
    if (!file || !validateFile(file, 'image')) {
        showNotification('Invalid file.', 'error');
        return;
    }
    if (!state.currentClubId) {
        showNotification('No club selected.', 'error');
        return;
    }
    await safeExecute(async () => {
        const reader = new FileReader();
        reader.onload = async () => { // Mark as async
            const imageBase64 = reader.result;
            await apiRequest(`/api/clubs/${state.currentClubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ image: imageBase64 }),
            });
            // Update state.clubData
            state.clubData = state.clubData.map(club =>
                club.id === state.currentClubId ? { ...club, image: imageBase64 } : club
            );
            localStorage.setItem(`clubs_${state.currentUserId}`, JSON.stringify(state.clubData));
            showNotification('Club profile picture updated!', 'success');
            // Close modal if it exists
            const modal = document.getElementById('club-profile-pic-modal'); // Adjust ID if different
            if (modal) toggleModal('club-profile-pic-modal', false);
            updateClubUI(state.clubData.find(club => club.id === state.currentClubId));
        };
        reader.onerror = () => {
            showNotification('Failed to read file.', 'error');
            throw new Error('File reading failed');
        };
        reader.readAsDataURL(file);
    }, 'Failed to update club profile picture.');
});

// Add update club profile picture to dropdown
if (dropdownContent) {
    const profilePicOption = document.createElement('div');
    profilePicOption.textContent = 'Update Club Profile Picture';
    profilePicOption.onclick = updateClubProfilePicture;
    dropdownContent.appendChild(profilePicOption);
}

// Handle club description update
function updateClubDescription() {
    const clubId = localStorage.getItem('currentClubId');
    const club = clubData.find(c => c.id === clubId);
    if (!club || (!club.moderators.includes(currentUserId) && club.creator.id !== currentUserId)) {
        showNotification('You do not have permission to update the description.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'club-description-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Update Club Description - ${sanitizeInput(club.name)}</h3>
                <button class="neumorphic-btn" onclick="closeModal('club-description-modal', false)">Close</button>
            </div>
            <div class="modal-body">
                <form id="club-description-form">
                    <div class="form-group">
                        <label for="club-description">Description</label>
                        <textarea id="club-description" name="description">${sanitizeInput(club.description || '')}</textarea>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="neumorphic-btn" onclick="closeModal('club-description-modal', false)">Cancel</button>
                        <button type="submit" class="neumorphic-btn primary">Update</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    document.getElementById('club-description-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('club-description').value.trim();

        await safeExecute(async () => {
            club.description = description;
            await apiRequest(`/api/clubs/${clubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ description })
            });
            localStorage.setItem(`clubs_${currentUserId}`, JSON.stringify(clubData));
            showNotification('Club description updated!', 'success');
            modal.remove();
            overlay.remove();
            updateClubInfo();
        }, 'Failed to update club description.');
    });


// Add update club description to dropdown
if (dropdownContent) {
    const descriptionOption = document.createElement('div');
    descriptionOption.textContent = 'Update Club Description';
    descriptionOption.onclick = updateClubDescription;
    dropdownContent.appendChild(descriptionOption);
}

// Initialize club info on load
if (localStorage.getItem('currentClubId')) {
    updateClubInfo();
    renderChatMessages(localStorage.getItem('currentClubId'));
    displayEvents(localStorage.getItem('currentClubId'));
    displayPolls(localStorage.getItem('currentClubId'));
    displayAnnouncements(localStorage.getItem('currentClubId'));
}

// Handle window load
window.addEventListener('load', () => {
    processOfflineQueue();
    renderClubLists();
    updateCategoryFilter();
	})
};

// Add global click handler to close menus
document.addEventListener('click', (e) => {
    if (!e.target.closest('.message-menu-btn')) {
        document.querySelectorAll('.message-menu-content.active').forEach(menu => menu.classList.remove('active'));
    }
});
