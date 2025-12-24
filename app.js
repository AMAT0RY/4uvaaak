// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// URL API сервера (настраивается в config.js или использует значение по умолчанию)
const API_URL = window.API_URL || 'https://dns.vrkids.ru';
let currentUser = null;
let currentImageId = null;

// Инициализация приложения
async function init() {
    try {
        // Получаем текущего пользователя
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/user/me?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        
        if (response.ok) {
            currentUser = await response.json();
        }
        
        // Загружаем начальные данные
        loadMyImages();
        loadSearchHistory();
        loadSubscriptions();
        
        // Настройка навигации
        setupNavigation();
        
        // Настройка модального окна
        setupModal();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

// Навигация
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
            
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    
    if (page === 'feed') {
        loadFeed();
    } else if (page === 'my') {
        loadMyImages();
    } else if (page === 'search') {
        loadSearchHistory();
    } else if (page === 'subscriptions') {
        loadSubscriptions();
    }
}

// Загрузка моих изображений
async function loadMyImages() {
    const container = document.getElementById('my-images');
    const loading = document.getElementById('my-loading');
    
    container.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/images/my?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        const images = await response.json();
        
        loading.style.display = 'none';
        
        if (images.length === 0) {
            container.innerHTML = '<div class="empty-state">У вас пока нет сохранённых картинок</div>';
            return;
        }
        
        displayImages(images, container);
    } catch (error) {
        console.error('Ошибка загрузки изображений:', error);
        loading.style.display = 'none';
        container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

// Загрузка ленты
async function loadFeed() {
    const container = document.getElementById('feed-images');
    const loading = document.getElementById('feed-loading');
    
    container.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/images/feed?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        const images = await response.json();
        
        loading.style.display = 'none';
        
        if (images.length === 0) {
            container.innerHTML = '<div class="empty-state">Подпишитесь на кого-нибудь, чтобы видеть их картинки в ленте</div>';
            return;
        }
        
        displayImages(images, container);
    } catch (error) {
        console.error('Ошибка загрузки ленты:', error);
        loading.style.display = 'none';
        container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

// Отображение изображений
function displayImages(images, container) {
    images.forEach(image => {
        const item = document.createElement('div');
        item.className = 'image-item';
        // Используем прокси endpoint для получения изображений
        const imageUrl = image.file_path 
            ? `${API_URL}/api/images/${image.id}/file`
            : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3C/svg%3E';
        item.innerHTML = `
            <img src="${imageUrl}" 
                 alt="" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3C/svg%3E'">
            <div class="image-overlay">
                <span>❤️ ${image.likes_count || 0}</span>
                <span>💬 ${image.comments_count || 0}</span>
            </div>
        `;
        
        item.addEventListener('click', () => openImageModal(image));
        container.appendChild(item);
    });
}

// Модальное окно
function setupModal() {
    const modal = document.getElementById('image-modal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Лайк
    document.getElementById('like-btn').addEventListener('click', toggleLike);
    
    // Комментарии
    document.getElementById('comment-btn').addEventListener('click', () => {
        const section = document.getElementById('comments-section');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('send-comment-btn').addEventListener('click', sendComment);
}

async function openImageModal(image) {
    currentImageId = image.id;
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    const likeBtn = document.getElementById('like-btn');
    const likeCount = document.getElementById('like-count');
    const likeIcon = document.getElementById('like-icon');
    
    // Загружаем изображение через прокси endpoint
    if (image.file_path) {
        modalImage.src = `${API_URL}/api/images/${image.id}/file`;
    } else {
        modalImage.src = '';
    }
    
    modalCaption.textContent = image.caption || '';
    likeCount.textContent = image.likes_count || 0;
    
    if (image.is_liked) {
        likeBtn.classList.add('liked');
        likeIcon.textContent = '❤️';
    } else {
        likeBtn.classList.remove('liked');
        likeIcon.textContent = '🤍';
    }
    
    // Загружаем комментарии
    await loadComments(image.id);
    
    modal.classList.add('active');
}

async function toggleLike() {
    if (!currentImageId) return;
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/images/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                image_id: currentImageId
            })
        });
        
        const result = await response.json();
        const likeBtn = document.getElementById('like-btn');
        const likeCount = document.getElementById('like-count');
        const likeIcon = document.getElementById('like-icon');
        
        likeCount.textContent = result.likes_count;
        
        if (result.is_liked) {
            likeBtn.classList.add('liked');
            likeIcon.textContent = '❤️';
        } else {
            likeBtn.classList.remove('liked');
            likeIcon.textContent = '🤍';
        }
    } catch (error) {
        console.error('Ошибка лайка:', error);
    }
}

async function loadComments(imageId) {
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '<div class="loading">Загрузка комментариев...</div>';
    
    try {
        const response = await fetch(`${API_URL}/api/images/${imageId}/comments`);
        const comments = await response.json();
        
        if (comments.length === 0) {
            commentsList.innerHTML = '<div class="empty-state">Пока нет комментариев</div>';
            return;
        }
        
        commentsList.innerHTML = '';
        comments.forEach(comment => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            item.innerHTML = `
                <div class="comment-author">${comment.first_name || comment.username || 'Пользователь'}</div>
                <div class="comment-text">${comment.text}</div>
            `;
            commentsList.appendChild(item);
        });
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        commentsList.innerHTML = '<div class="empty-state">Ошибка загрузки комментариев</div>';
    }
}

async function sendComment() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    
    if (!text || !currentImageId) return;
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/images/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                image_id: currentImageId,
                text: text
            })
        });
        
        const result = await response.json();
        input.value = '';
        await loadComments(currentImageId);
    } catch (error) {
        console.error('Ошибка отправки комментария:', error);
    }
}

// Поиск
document.getElementById('search-btn').addEventListener('click', performSearch);
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

async function performSearch() {
    const username = document.getElementById('search-input').value.trim();
    if (!username) return;
    
    const resultsDiv = document.getElementById('search-results');
    const profileDiv = document.getElementById('user-profile');
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/user/username/${username}?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        
        if (response.status === 404) {
            resultsDiv.innerHTML = '<div class="empty-state">Пользователь не найден</div>';
            profileDiv.style.display = 'none';
            return;
        }
        
        const user = await response.json();
        displayUserProfile(user);
        
        // Загружаем изображения пользователя
        await loadUserImages(user.telegram_id);
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        resultsDiv.innerHTML = '<div class="empty-state">Ошибка поиска</div>';
    }
}

async function displayUserProfile(user) {
    const profileDiv = document.getElementById('user-profile');
    const usernameDiv = document.getElementById('profile-username');
    const nameDiv = document.getElementById('profile-name');
    const subscribeBtn = document.getElementById('subscribe-btn');
    
    usernameDiv.textContent = `@${user.username || 'без username'}`;
    nameDiv.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Без имени';
    
    // Проверяем подписку
    if (currentUser && currentUser.id !== user.id) {
        const initData = tg.initData;
        const subResponse = await fetch(`${API_URL}/api/subscriptions?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        const subscriptions = await subResponse.json();
        const isSubscribed = subscriptions.some(s => s.telegram_id === user.telegram_id);
        
        subscribeBtn.textContent = isSubscribed ? 'Отписаться' : 'Подписаться';
        subscribeBtn.classList.toggle('subscribed', isSubscribed);
        subscribeBtn.onclick = () => toggleSubscription(user.id);
        subscribeBtn.style.display = 'block';
    } else {
        subscribeBtn.style.display = 'none';
    }
    
    profileDiv.style.display = 'block';
}

async function loadUserImages(userTelegramId) {
    const container = document.getElementById('user-images');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const initData = tg.initData;
        // Используем telegram_id для получения изображений пользователя
        const response = await fetch(`${API_URL}/api/images/user/${userTelegramId}?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        const images = await response.json();
        
        container.innerHTML = '';
        
        if (images.length === 0) {
            container.innerHTML = '<div class="empty-state">У пользователя пока нет сохранённых картинок</div>';
            return;
        }
        
        displayImages(images, container);
    } catch (error) {
        console.error('Ошибка загрузки изображений пользователя:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

async function toggleSubscription(targetId) {
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/subscriptions/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                target_id: targetId
            })
        });
        
        const result = await response.json();
        const subscribeBtn = document.getElementById('subscribe-btn');
        subscribeBtn.textContent = result.is_subscribed ? 'Отписаться' : 'Подписаться';
        subscribeBtn.classList.toggle('subscribed', result.is_subscribed);
    } catch (error) {
        console.error('Ошибка подписки:', error);
    }
}

async function loadSearchHistory() {
    const historyDiv = document.getElementById('search-history');
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/search/history?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        const history = await response.json();
        
        if (history.length === 0) {
            historyDiv.innerHTML = '';
            return;
        }
        
        historyDiv.innerHTML = '<h3>История поиска</h3>';
        history.forEach(username => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.textContent = `@${username}`;
            item.addEventListener('click', () => {
                document.getElementById('search-input').value = username;
                performSearch();
            });
            historyDiv.appendChild(item);
        });
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
    }
}

async function loadSubscriptions() {
    const container = document.getElementById('subscriptions-list');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${API_URL}/api/subscriptions?initData=${encodeURIComponent(initData)}&user_id=${tg.initDataUnsafe.user?.id || ''}`);
        const subscriptions = await response.json();
        
        container.innerHTML = '';
        
        if (subscriptions.length === 0) {
            container.innerHTML = '<div class="empty-state">Вы пока ни на кого не подписаны</div>';
            return;
        }
        
        subscriptions.forEach(user => {
            const item = document.createElement('div');
            item.className = 'subscription-item';
            item.innerHTML = `
                <div>
                    <strong>${user.first_name || ''} ${user.last_name || ''}</strong>
                    <div>@${user.username || 'без username'}</div>
                </div>
                <button class="nav-btn" onclick="viewUserProfile(${user.telegram_id})">Открыть</button>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Ошибка загрузки подписок:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

async function viewUserProfile(telegramId) {
    // Переключаемся на страницу поиска
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.page === 'search') {
            btn.click();
        }
    });
    
    // Находим пользователя и отображаем его профиль
    // Это упрощенная версия, в реальном приложении нужен endpoint для поиска по telegram_id
}


// Запуск приложения
init();

