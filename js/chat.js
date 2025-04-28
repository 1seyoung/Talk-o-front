// 전역 변수
let currentRoomId = null;
let rooms = [];
let invitations = [];
let activeRoom = null;
let currentUser = {
  id: null,
  name: null,
  email: null
};
let stompClient = null;
let isConnected = false;
let roomSubscriptions = {};

// DOM 요소 참조
document.addEventListener('DOMContentLoaded', function() {
  // 인증 확인
  const accessToken = localStorage.getItem('accessToken');
  const userName = localStorage.getItem('userName');
  
  if (!accessToken || !userName) {
    // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    window.location.href = 'login.html';
    return;
  }
  
  // 현재 사용자 정보 설정
  currentUser.id = localStorage.getItem('userId');
  currentUser.name = userName;
  currentUser.email = localStorage.getItem('userEmail');
  
  // 사용자 정보 표시
  document.getElementById('username').textContent = userName;
  document.getElementById('profileImg').textContent = userName.charAt(0).toUpperCase();
  
  // 웹소켓 연결
  connectWebSocket();
  
  // 초기 데이터 로드
  loadChatRooms();
  loadInvitations();
  
  // 이벤트 리스너 설정
  setupEventListeners();
});

// 웹소켓 연결
function connectWebSocket() {
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) {
    console.error('인증 토큰이 없습니다. 로그인이 필요합니다.');
    return;
  }

  // SockJS와 STOMP 클라이언트 설정
  const socket = new SockJS('http://localhost:8081/ws');
  stompClient = Stomp.over(socket);
  stompClient.debug = null; // 개발 시에만 주석 해제 (디버그 활성화)

  // 헤더에 인증 토큰 추가
  const headers = {
    'Authorization': `Bearer ${accessToken}`
  };

  // 연결 시도
  stompClient.connect(
    headers,
    (frame) => {
      console.log('웹소켓 연결 성공:', frame);
      isConnected = true;
      
      // 마지막으로 활성화된 채팅방이 있으면 자동 입장
      const lastActiveRoomId = localStorage.getItem('lastActiveRoomId');
      if (lastActiveRoomId && currentRoomId === parseInt(lastActiveRoomId)) {
        enterChatRoom(currentRoomId);
      }
    },
    (error) => {
      console.error('웹소켓 연결 실패:', error);
      isConnected = false;
      // 몇 초 후 재연결 시도
      setTimeout(() => connectWebSocket(), 5000);
    }
  );
}

// 채팅방 입장
function enterChatRoom(roomId) {
  if (!isConnected || !stompClient) {
    console.error('웹소켓이 연결되지 않았습니다.');
    return;
  }

  // 이전 구독이 있으면 해제
  if (roomSubscriptions[roomId]) {
    unsubscribeFromRoom(roomId);
  }

  // 채팅방 입장 메시지 전송
  stompClient.send(`/app/chat/enter/${roomId}`, {}, JSON.stringify({}));
  
  // 채팅방 메시지 구독
  subscribeToRoom(roomId);
}

// 채팅방 구독
function subscribeToRoom(roomId) {
  if (!isConnected || !stompClient) {
    console.error('웹소켓이 연결되지 않았습니다.');
    return;
  }

  if (roomId == -1) {
    const privateSubscription = stompClient.subscribe(
      `/user/queue/chat`,
      (message) => {
        console.log('✅ [수신] 나와의 채팅 수신됨:', message);
        handleIncomingMessage(message, roomId);
      }
    );
    console.log('✅ [구독] 나와의 채팅 구독 완료: /user/queue/chat');
    roomSubscriptions[roomId] = { private: privateSubscription };
  } else {
    // 일반 채팅방은 그룹 채팅 구독
    const groupSubscription = stompClient.subscribe(
      `/topic/chat/room/${roomId}`,
      (message) => handleIncomingMessage(message, roomId)
    );
    roomSubscriptions[roomId] = { group: groupSubscription };
  }
}

// 채팅방 구독 해제
function unsubscribeFromRoom(roomId) {
  if (roomSubscriptions[roomId]) {
    if (roomSubscriptions[roomId].group) {
      roomSubscriptions[roomId].group.unsubscribe();
    }
    if (roomSubscriptions[roomId].private) {
      roomSubscriptions[roomId].private.unsubscribe();
    }
    delete roomSubscriptions[roomId];
  }
}

// 수신된 메시지 처리
function handleIncomingMessage(message, roomId) {
  try {
    const messageData = JSON.parse(message.body);
    console.log('메시지 수신:', messageData);

    messageData.isCurrentUser = messageData.senderId
      ? messageData.senderId === parseInt(currentUser.id)
      : (messageData.messageType === 'PRIVATE'); // 여기 추가!!!

    if (messageData.messageType === 'PRIVATE') {
      displayTextMessage(messageData);
    } else if (roomId === currentRoomId) {
      switch (messageData.contentType) {
        case 'TEXT':
          displayTextMessage(messageData);
          break;
        case 'CODE':
          displayCodeMessage(messageData);
          break;
        case 'IMAGE':
          displayImageMessage(messageData);
          break;
        case 'FILE':
          displayFileMessage(messageData);
          break;
        default:
          console.warn('처리되지 않은 메시지 타입:', messageData.contentType);
      }
    }
  } catch (error) {
    console.error('메시지 처리 오류:', error);
  }
}

// 텍스트 메시지 표시
function displayTextMessage(messageData) {
  const chatMessages = document.getElementById('chatMessages');
  const isCurrentUser = messageData.isCurrentUser;
  
  const messageElement = document.createElement('div');
  messageElement.className = isCurrentUser ? 'message message-sent' : 'message message-received';
  
  // 메시지 시간 형식 변환
  const messageTime = new Date(messageData.timestamp || new Date());
  const formattedTime = `${messageTime.getHours()}:${String(messageTime.getMinutes()).padStart(2, '0')}`;
  
  // 다른 사용자의 메시지인 경우 발신자 이름 표시
  let senderName = '';
  if (!isCurrentUser) {
    senderName = `<div class="message-sender">${messageData.senderName || '알 수 없음'}</div>`;
  }
  
  // 메시지 내용 추출
  let textContent = '';
  if (messageData.content && messageData.content.text) {
    textContent = messageData.content.text;
  } else {
    textContent = '메시지를 표시할 수 없습니다';
  }
  
  messageElement.innerHTML = `
    ${senderName}
    <div class="message-content">${textContent}</div>
    <div class="message-time">${formattedTime}</div>
  `;
  
  chatMessages.appendChild(messageElement);
  
  // 스크롤을 최하단으로 이동
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 코드 메시지 표시
function displayCodeMessage(messageData) {
  const chatMessages = document.getElementById('chatMessages');
  const isCurrentUser = messageData.isCurrentUser;
  
  const messageElement = document.createElement('div');
  messageElement.className = isCurrentUser ? 'message message-sent' : 'message message-received';
  messageElement.classList.add('code-message');
  
  // 메시지 시간 형식 변환
  const messageTime = new Date(messageData.timestamp || new Date());
  const formattedTime = `${messageTime.getHours()}:${String(messageTime.getMinutes()).padStart(2, '0')}`;
  
  // 다른 사용자의 메시지인 경우 발신자 이름 표시
  let senderName = '';
  if (!isCurrentUser) {
    senderName = `<div class="message-sender">${messageData.senderName || '알 수 없음'}</div>`;
  }
  
  const codeContent = messageData.content || {};
  const language = codeContent.language || 'plaintext';
  const code = codeContent.code || '코드 내용을 표시할 수 없습니다';
  
  messageElement.innerHTML = `
    ${senderName}
    <div class="code-block">
      <div class="code-header">
        <span class="code-language">${language}</span>
        <button class="copy-btn" title="코드 복사">
          <i class="fas fa-copy"></i>
        </button>
      </div>
      <pre><code class="language-${language}">${code}</code></pre>
    </div>
    <div class="message-time">${formattedTime}</div>
  `;
  
  chatMessages.appendChild(messageElement);
  
  // 코드 복사 버튼 이벤트 리스너
  const copyBtn = messageElement.querySelector('.copy-btn');
  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(code)
      .then(() => {
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
      })
      .catch(err => {
        console.error('코드 복사 실패:', err);
      });
  });
  
  // 코드 구문 강조 적용 (highlight.js를 사용)
  if (window.hljs) {
    messageElement.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }
  
  // 스크롤을 최하단으로 이동
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 이미지 메시지 표시
function displayImageMessage(messageData) {
  const chatMessages = document.getElementById('chatMessages');
  const isCurrentUser = messageData.isCurrentUser;
  
  const messageElement = document.createElement('div');
  messageElement.className = isCurrentUser ? 'message message-sent' : 'message message-received';
  messageElement.classList.add('image-message');
  
  // 메시지 시간 형식 변환
  const messageTime = new Date(messageData.timestamp || new Date());
  const formattedTime = `${messageTime.getHours()}:${String(messageTime.getMinutes()).padStart(2, '0')}`;
  
  // 다른 사용자의 메시지인 경우 발신자 이름 표시
  let senderName = '';
  if (!isCurrentUser) {
    senderName = `<div class="message-sender">${messageData.senderName || '알 수 없음'}</div>`;
  }
  
  const imageUrl = messageData.content && messageData.content.url ? messageData.content.url : '';
  
  messageElement.innerHTML = `
    ${senderName}
    <div class="image-container">
      <img src="${imageUrl}" alt="이미지" class="message-image">
    </div>
    <div class="message-time">${formattedTime}</div>
  `;
  
  chatMessages.appendChild(messageElement);
  
  // 이미지 클릭 시 원본 크기로 보기
  const imageElement = messageElement.querySelector('.message-image');
  imageElement.addEventListener('click', function() {
    const imageViewer = document.createElement('div');
    imageViewer.className = 'image-viewer-modal';
    imageViewer.innerHTML = `
      <div class="image-viewer-content">
        <span class="image-viewer-close">&times;</span>
        <img src="${imageUrl}" class="image-viewer-img">
      </div>
    `;
    document.body.appendChild(imageViewer);
    
    // 닫기 버튼 및 모달 외부 클릭 시 닫기
    imageViewer.addEventListener('click', function(e) {
      if (e.target === imageViewer || e.target.className === 'image-viewer-close') {
        document.body.removeChild(imageViewer);
      }
    });
  });
  
  // 스크롤을 최하단으로 이동
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 파일 메시지 표시
function displayFileMessage(messageData) {
  const chatMessages = document.getElementById('chatMessages');
  const isCurrentUser = messageData.isCurrentUser;
  
  const messageElement = document.createElement('div');
  messageElement.className = isCurrentUser ? 'message message-sent' : 'message message-received';
  messageElement.classList.add('file-message');
  
  // 메시지 시간 형식 변환
  const messageTime = new Date(messageData.timestamp || new Date());
  const formattedTime = `${messageTime.getHours()}:${String(messageTime.getMinutes()).padStart(2, '0')}`;
  
  // 다른 사용자의 메시지인 경우 발신자 이름 표시
  let senderName = '';
  if (!isCurrentUser) {
    senderName = `<div class="message-sender">${messageData.senderName || '알 수 없음'}</div>`;
  }
  
  const fileData = messageData.content || {};
  const fileName = fileData.fileName || '파일';
  const fileSize = fileData.fileSize || 0;
  const fileUrl = fileData.url || '#';
  const mimeType = fileData.mimeType || '';
  
  const fileIcon = getFileIconByType(mimeType);
  
  messageElement.innerHTML = `
    ${senderName}
    <div class="file-container">
      <div class="file-icon"><i class="${fileIcon}"></i></div>
      <div class="file-info">
        <div class="file-name">${fileName}</div>
        <div class="file-size">${formatFileSize(fileSize)}</div>
      </div>
      <a href="${fileUrl}" class="file-download-btn" download="${fileName}">
        <i class="fas fa-download"></i>
      </a>
    </div>
    <div class="message-time">${formattedTime}</div>
  `;
  
  chatMessages.appendChild(messageElement);
  
  // 스크롤을 최하단으로 이동
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 파일 타입에 따른 아이콘 가져오기
function getFileIconByType(mimeType) {
  if (!mimeType) return 'fas fa-file';
  
  if (mimeType.startsWith('image/')) {
    return 'fas fa-file-image';
  } else if (mimeType.startsWith('video/')) {
    return 'fas fa-file-video';
  } else if (mimeType.startsWith('audio/')) {
    return 'fas fa-file-audio';
  } else if (mimeType === 'application/pdf') {
    return 'fas fa-file-pdf';
  } else if (mimeType.includes('word') || mimeType === 'application/msword') {
    return 'fas fa-file-word';
  } else if (mimeType.includes('excel') || mimeType === 'application/vnd.ms-excel') {
    return 'fas fa-file-excel';
  } else if (mimeType.includes('powerpoint') || mimeType === 'application/vnd.ms-powerpoint') {
    return 'fas fa-file-powerpoint';
  } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz')) {
    return 'fas fa-file-archive';
  } else if (mimeType.includes('text/') || mimeType.includes('json')) {
    return 'fas fa-file-alt';
  } else if (mimeType.includes('javascript') || mimeType.includes('css') || mimeType.includes('html')) {
    return 'fas fa-file-code';
  }
  
  return 'fas fa-file';
}

// 파일 크기 포맷
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 메시지 전송
function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();
  
  if (!message || !currentRoomId || !stompClient || !isConnected) return;
  
  const messageData = {
    messageType: currentRoomId == -1 ? 'PRIVATE' : 'GROUP', 
    contentType: 'TEXT',
    content: {
      text: message
    }
  };
  
  stompClient.send(`/app/chat/message/${currentRoomId}`, {}, JSON.stringify(messageData));
  
  messageInput.value = '';
  messageInput.focus();
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 드롭다운 메뉴 토글
  const dropdowns = document.querySelectorAll('.dropdown');
  dropdowns.forEach(dropdown => {
    dropdown.addEventListener('click', function(e) {
      e.stopPropagation();
      const menu = this.querySelector('.dropdown-menu');
      // 다른 모든 드롭다운 메뉴 닫기
      document.querySelectorAll('.dropdown-menu').forEach(item => {
        if (item !== menu) item.classList.remove('show');
      });
      // 현재 메뉴 토글
      menu.classList.toggle('show');
    });
  });
  
  // 화면 클릭 시 드롭다운 메뉴 닫기
  document.addEventListener('click', function() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  });
  
  // 새 채팅방 버튼 클릭
  document.getElementById('newChatBtn').addEventListener('click', function() {
    document.getElementById('newChatModal').style.display = 'flex';
    document.getElementById('roomName').value = '';
    document.getElementById('roomName').focus();
  });
  
  document.getElementById('startChatBtn').addEventListener('click', function() {
    document.getElementById('newChatModal').style.display = 'flex';
    document.getElementById('roomName').value = '';
    document.getElementById('roomName').focus();
  });
  
  // 모달 닫기 버튼
  document.querySelectorAll('.modal-close, #cancelBtn, #closeInfoBtn, #cancelInviteBtn, #closeInvitationsBtn').forEach(button => {
    button.addEventListener('click', function() {
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });
  
  // 모달 바깥 클릭 시 닫기
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', function(e) {
      if (e.target === this) {
        this.style.display = 'none';
      }
    });
  });
  
  // 채팅방 생성 버튼 클릭
  document.getElementById('createRoomBtn').addEventListener('click', createRoom);
  
  // 채팅방 목록 검색
  document.getElementById('searchInput').addEventListener('input', function() {
    const searchText = this.value.toLowerCase();
    filterChatRooms(searchText);
  });
  
  // 초대 버튼 클릭
  document.getElementById('inviteBtn').addEventListener('click', function() {
    document.getElementById('inviteModal').style.display = 'flex';
    document.getElementById('inviteeId').value = '';
    document.getElementById('inviteeId').focus();
  });
  
  // 초대 보내기 버튼 클릭
  document.getElementById('sendInviteBtn').addEventListener('click', sendInvitation);
  
  // 채팅방 정보 버튼 클릭
  document.getElementById('infoBtn').addEventListener('click', function() {
    if (activeRoom) {
      loadRoomInfo(activeRoom.id);
      document.getElementById('roomInfoModal').style.display = 'flex';
    }
  });
  
  // 모든 초대 보기 버튼 클릭
  document.getElementById('viewAllInvitations').addEventListener('click', function() {
    loadAllInvitations();
    document.getElementById('invitationsListModal').style.display = 'flex';
  });
  
  // 로그아웃 버튼 클릭
  document.getElementById('logoutBtn').addEventListener('click', function() {
    // 웹소켓 연결 종료
    if (stompClient) {
      stompClient.disconnect();
    }
    
    // 로그아웃 API 호출
    apiRequest('/api/auth/logout', 'POST')
      .catch(error => {
        console.error('로그아웃 API 오류:', error);
      })
      .finally(() => {
        // localStorage에서 모든 사용자 데이터 삭제
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        localStorage.removeItem('lastActiveRoomId');
        
        // 홈페이지로 리다이렉트
        window.location.href = 'index.html';
      });
  });
  
  // 메시지 전송 버튼 클릭
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  
  // 메시지 입력 필드에서 엔터 키 입력 처리
  document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // 코드 전송 버튼 클릭 이벤트 추가
  const codeBtn = document.getElementById('codeBtn');
  if (codeBtn) {
    codeBtn.addEventListener('click', sendCodeMessage);
  }

  //fake zone
  // 가짜 메시지 전송 버튼 이벤트 추가
const sendFakeCodeBtn = document.getElementById('sendFakeCodeBtn');
const sendFakeImageBtn = document.getElementById('sendFakeImageBtn');
const sendFakeFileBtn = document.getElementById('sendFakeFileBtn');

if (sendFakeCodeBtn) {
  sendFakeCodeBtn.addEventListener('click', sendFakeCodeMessage);
}
if (sendFakeImageBtn) {
  sendFakeImageBtn.addEventListener('click', sendFakeImageMessage);
}
if (sendFakeFileBtn) {
  sendFakeFileBtn.addEventListener('click', sendFakeFileMessage);
}
}

// API 요청 함수
async function apiRequest(url, method = 'GET', data = null) {
  const accessToken = localStorage.getItem('accessToken');
  
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`http://localhost:8081${url}`, options);
    
    if (!response.ok) {
      if (response.status === 401) {
        // 인증 오류 시 로그인 페이지로 리다이렉트
        localStorage.removeItem('accessToken');
        window.location.href = 'login.html';
        return null;
      }
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    
    // 204 No Content 응답 처리
    if (response.status === 204) {
      return true;
    }
    
    return await response.json();
  } catch (error) {
    console.error('API 오류:', error);
    return null;
  }
}

// 채팅방 목록 로드
async function loadChatRooms() {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <span>채팅방 목록을 불러오는 중...</span>
    </div>
  `;
  
  try {
    const response = await apiRequest('/api/rooms');
    
    if (!response) {
      chatList.innerHTML = `<div class="empty-notifications">채팅방 목록을 불러올 수 없습니다.</div>`;
      return;
    }
    
    rooms = response; // 전역 변수에 저장
    
    if (rooms.length === 0) {
      chatList.innerHTML = `<div class="empty-notifications">참여 중인 채팅방이 없습니다.</div>`;
      return;
    }
    
    // 채팅방 목록 렌더링
    renderChatRooms(rooms);
    
    // 마지막으로 활성화된 채팅방 확인
    const lastActiveRoomId = localStorage.getItem('lastActiveRoomId');
    if (lastActiveRoomId) {
      const room = rooms.find(r => r.id === parseInt(lastActiveRoomId));
      if (room) {
        selectChatRoom(room);
      }
    }
  } catch (error) {
    console.error('채팅방 목록 로드 오류:', error);
    chatList.innerHTML = `<div class="empty-notifications">채팅방 목록을 불러올 수 없습니다.</div>`;
  }
}

// 나와의 채팅방 로드
async function loadSelfChatRoom() {
  try {
    const response = await apiRequest('/api/rooms/self');
    
    if (!response) {
      console.error('나와의 채팅방을 불러올 수 없습니다.');
      return;
    }
    
    // 나와의 채팅방 정보를 설정하고 선택
    const selfRoom = {
      id: response.id,
      name: response.name || '나와의 채팅',
      members: response.members,
      participantCount: response.members ? response.members.length : 1
    };
    
    selectChatRoom(selfRoom);
  } catch (error) {
    console.error('나와의 채팅방 로드 오류:', error);
  }
}

// 채팅방 목록 렌더링
function renderChatRooms(roomList) {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '';
  
  // 나와의 채팅방 추가 (항상 맨 위에 표시)
  const selfChatItem = document.createElement('div');
  selfChatItem.className = 'chat-item';
  selfChatItem.dataset.roomId = '-1'; // 나와의 채팅방은 특별한 ID 사용
  
  selfChatItem.innerHTML = `
    <div class="chat-avatar">
      <i class="fas fa-user"></i>
    </div>
    <div class="chat-details">
      <div class="chat-name">나와의 채팅</div>
      <div class="chat-participants">개인 메모</div>
    </div>
  `;
  
  selfChatItem.addEventListener('click', () => loadSelfChatRoom());
  chatList.appendChild(selfChatItem);
  
  // 일반 채팅방 목록 렌더링
  roomList.forEach(room => {
    // 나와의 채팅방은 이미 추가했으므로 건너뜀
    if (room.id === -1) return;
    
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.roomId = room.id;
    
    // 첫 글자를 가져와 아바타로 사용
    const firstChar = room.name.charAt(0).toUpperCase();
    
    chatItem.innerHTML = `
      <div class="chat-avatar">${firstChar}</div>
      <div class="chat-details">
        <div class="chat-name">${room.name}</div>
        <div class="chat-participants">참여자 ${room.participantCount || (room.members ? room.members.length : 0)}명</div>
      </div>
    `;
    
    chatItem.addEventListener('click', () => selectChatRoom(room));
    chatList.appendChild(chatItem);
  });
}

// 채팅방 선택
function selectChatRoom(room) {
  // 현재 활성화된 채팅방이 있으면 비활성화
  const activeItem = document.querySelector('.chat-item.active');
  if (activeItem) {
    activeItem.classList.remove('active');
  }
  
  // 선택한 채팅방 활성화
  const chatItem = document.querySelector(`.chat-item[data-room-id="${room.id}"]`);
  if (chatItem) {
    chatItem.classList.add('active');
  }
  
  // 전역 변수에 저장
  currentRoomId = room.id;
  activeRoom = room;
  
  // 마지막 활성화된 채팅방 ID 저장
  localStorage.setItem('lastActiveRoomId', room.id);
  
  // 채팅방 상세 정보 로드
// 채팅방 상세 정보 로드
if (room.id !== -1) { // 일반 채팅방인 경우
  loadRoomInfo(room.id);
}

// 채팅 UI 보이기
document.getElementById('welcomeMessage').style.display = 'none';
document.getElementById('chatContainer').style.display = 'flex';

// 채팅방 정보 표시
document.getElementById('chatTitle').textContent = room.name;
document.getElementById('chatMembers').textContent = `참여자 ${room.participantCount || (room.members ? room.members.length : 0)}명`;

// 채팅 메시지 영역 초기화
document.getElementById('chatMessages').innerHTML = `
  <div class="chat-date-divider">
    <span>오늘</span>
  </div>
`;

// 메시지 입력 필드 포커스
document.getElementById('messageInput').focus();

// 웹소켓 채팅방 입장
if (isConnected && stompClient) {
  enterChatRoom(room.id);
}
}

// 채팅방 필터링
function filterChatRooms(searchText) {
if (!searchText) {
  renderChatRooms(rooms);
  return;
}

const filteredRooms = rooms.filter(room => 
  room.name.toLowerCase().includes(searchText)
);

renderChatRooms(filteredRooms);
}

// 채팅방 생성
async function createRoom() {
const roomName = document.getElementById('roomName').value.trim();

if (!roomName) {
  alert('채팅방 이름을 입력해주세요.');
  return;
}

const createBtn = document.getElementById('createRoomBtn');
createBtn.disabled = true;
createBtn.textContent = '생성 중...';

try {
  const response = await apiRequest('/api/rooms', 'POST', { name: roomName });
  
  if (response) {
    // 모달 닫기
    document.getElementById('newChatModal').style.display = 'none';
    
    // 채팅방 목록 새로고침
    await loadChatRooms();
    
    // 새로 생성된 채팅방 선택
    const newRoom = rooms.find(r => r.id === response.id);
    if (newRoom) {
      selectChatRoom(newRoom);
    }
  } else {
    alert('채팅방을 생성하지 못했습니다.');
  }
} catch (error) {
  console.error('채팅방 생성 오류:', error);
  alert('채팅방 생성 중 오류가 발생했습니다.');
} finally {
  createBtn.disabled = false;
  createBtn.textContent = '생성하기';
}
}

// 초대장 보내기
async function sendInvitation() {
if (!activeRoom) {
  alert('먼저 채팅방을 선택해주세요.');
  return;
}

const inviteeId = document.getElementById('inviteeId').value.trim();

if (!inviteeId) {
  alert('초대할 사용자 ID를 입력해주세요.');
  return;
}

const sendBtn = document.getElementById('sendInviteBtn');
sendBtn.disabled = true;
sendBtn.textContent = '초대 중...';

try {
  const response = await apiRequest(`/api/rooms/${activeRoom.id}/invite`, 'POST', { inviteeId: parseInt(inviteeId) });
  
  if (response) {
    // 모달 닫기
    document.getElementById('inviteModal').style.display = 'none';
    alert('초대장을 성공적으로 보냈습니다.');
  } else {
    alert('초대장을 보내지 못했습니다.');
  }
} catch (error) {
  console.error('초대장 보내기 오류:', error);
  alert('초대장 보내기 중 오류가 발생했습니다.');
} finally {
  sendBtn.disabled = false;
  sendBtn.textContent = '초대하기';
}
}

// 초대 목록 로드
async function loadInvitations() {
try {
  const response = await apiRequest('/api/invitations');
  
  if (!response) {
    return;
  }
  
  invitations = response; // 전역 변수에 저장
  
  // 초대장 개수 표시
  const pendingInvitations = invitations.filter(invite => invite.status === 'PENDING');
  const badge = document.getElementById('notificationBadge');
  
  if (pendingInvitations.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = pendingInvitations.length;
    
    // 알림 목록 렌더링
    renderInvitationNotifications(pendingInvitations);
  } else {
    badge.style.display = 'none';
  }
} catch (error) {
  console.error('초대 목록 로드 오류:', error);
}
}

// 알림 목록 렌더링
function renderInvitationNotifications(invitationsList) {
const invitationsContainer = document.getElementById('invitationsList');
invitationsContainer.innerHTML = '';

if (invitationsList.length === 0) {
  invitationsContainer.innerHTML = `<div class="empty-notifications">새 알림이 없습니다</div>`;
  return;
}

invitationsList.forEach(invitation => {
  const invitationItem = document.createElement('div');
  invitationItem.className = 'notification-item';
  
  // 시간 형식 변환
  const invitedDate = new Date(invitation.invitedAt);
  const formattedDate = `${invitedDate.getMonth() + 1}/${invitedDate.getDate()} ${invitedDate.getHours()}:${String(invitedDate.getMinutes()).padStart(2, '0')}`;
  
  invitationItem.innerHTML = `
    <div class="notification-title">채팅방 초대</div>
    <div class="notification-desc">채팅방 ${invitation.chatroomId}에 초대되었습니다.</div>
    <div class="notification-actions">
      <button class="notification-btn notification-btn-accept" data-invitation-id="${invitation.invitationId}">수락</button>
      <button class="notification-btn notification-btn-reject" data-invitation-id="${invitation.invitationId}">거절</button>
    </div>
  `;
  
  invitationsContainer.appendChild(invitationItem);
});

// 수락/거절 버튼에 이벤트 리스너 추가
invitationsContainer.querySelectorAll('.notification-btn-accept').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    acceptInvitation(btn.dataset.invitationId);
  });
});

invitationsContainer.querySelectorAll('.notification-btn-reject').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    rejectInvitation(btn.dataset.invitationId);
  });
});
}

// 모든 초대 목록 로드
async function loadAllInvitations() {
const invitationsContainer = document.getElementById('invitationsContainer');
invitationsContainer.innerHTML = `
  <div class="loading">
    <div class="loading-spinner"></div>
    <span>초대 목록을 불러오는 중...</span>
  </div>
`;

try {
  const response = await apiRequest('/api/invitations');
  
  if (!response) {
    invitationsContainer.innerHTML = `<div class="empty-invitations">초대 목록을 불러올 수 없습니다.</div>`;
    return;
  }
  
  invitations = response; // 전역 변수에 저장
  
  if (invitations.length === 0) {
    invitationsContainer.innerHTML = `<div class="empty-invitations">받은 초대가 없습니다.</div>`;
    return;
  }
  
  // 초대 목록 렌더링
  invitationsContainer.innerHTML = '';
  
  invitations.forEach(invitation => {
    const invitationItem = document.createElement('div');
    invitationItem.className = 'invitation-item';
    
    // 시간 형식 변환
    const invitedDate = new Date(invitation.invitedAt);
    const formattedDate = `${invitedDate.getMonth() + 1}/${invitedDate.getDate()} ${invitedDate.getHours()}:${String(invitedDate.getMinutes()).padStart(2, '0')}`;
    
    let statusText = '';
    let actionButtons = '';
    
    switch (invitation.status) {
      case 'PENDING':
        statusText = '대기 중';
        actionButtons = `
          <div class="invitation-actions">
            <button class="btn btn-success accept-btn" data-invitation-id="${invitation.invitationId}">수락</button>
            <button class="btn btn-danger reject-btn" data-invitation-id="${invitation.invitationId}">거절</button>
          </div>
        `;
        break;
      case 'ACCEPTED':
        statusText = '수락됨';
        break;
      case 'REJECTED':
        statusText = '거절됨';
        break;
    }
    
    invitationItem.innerHTML = `
      <div class="invitation-header">
        <div class="invitation-title">채팅방 초대</div>
        <div class="invitation-time">${formattedDate}</div>
      </div>
      <div class="invitation-details">
        <p>채팅방 ID: ${invitation.chatroomId}</p>
        <p>초대한 사용자 ID: ${invitation.inviterId}</p>
        <p>상태: ${statusText}</p>
      </div>
      ${actionButtons}
    `;
    
    invitationsContainer.appendChild(invitationItem);
  });
  
  // 수락/거절 버튼에 이벤트 리스너 추가
  invitationsContainer.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', () => acceptInvitation(btn.dataset.invitationId));
  });
  
  invitationsContainer.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => rejectInvitation(btn.dataset.invitationId));
  });
} catch (error) {
  console.error('초대 목록 로드 오류:', error);
  invitationsContainer.innerHTML = `<div class="empty-invitations">초대 목록을 불러올 수 없습니다.</div>`;
}
}

// 초대 수락
async function acceptInvitation(invitationId) {
try {
  const response = await apiRequest(`/api/invitations/${invitationId}/accept`, 'POST');
  
  if (response !== null) {
    alert('초대를 수락했습니다.');
    
    // 초대 목록 새로고침
    loadInvitations();
    
    // 모달이 열려있으면 갱신
    if (document.getElementById('invitationsListModal').style.display === 'flex') {
      loadAllInvitations();
    }
    
    // 채팅방 목록 새로고침
    loadChatRooms();
  } else {
    alert('초대 수락에 실패했습니다.');
  }
} catch (error) {
  console.error('초대 수락 오류:', error);
  alert('초대 수락 중 오류가 발생했습니다.');
}
}

// 초대 거절
async function rejectInvitation(invitationId) {
try {
  const response = await apiRequest(`/api/invitations/${invitationId}/reject`, 'POST');
  
  if (response !== null) {
    alert('초대를 거절했습니다.');
    
    // 초대 목록 새로고침
    loadInvitations();
    
    // 모달이 열려있으면 갱신
    if (document.getElementById('invitationsListModal').style.display === 'flex') {
      loadAllInvitations();
    }
  } else {
    alert('초대 거절에 실패했습니다.');
  }
} catch (error) {
  console.error('초대 거절 오류:', error);
  alert('초대 거절 중 오류가 발생했습니다.');
}
}

// 채팅방 정보 로드
async function loadRoomInfo(roomId) {
try {
  const response = await apiRequest(`/api/rooms/${roomId}`);
  
  if (!response) {
    return;
  }
  
  // 채팅방 정보 표시
  document.getElementById('roomInfoName').textContent = response.name;
  document.getElementById('roomInfoHost').textContent = response.hostName;
  document.getElementById('roomInfoMemberCount').textContent = response.members ? response.members.length : 0;
  
  // 멤버 목록 렌더링
  const membersList = document.getElementById('roomMembersList');
  membersList.innerHTML = '';
  
  if (response.members && response.members.length > 0) {
    response.members.forEach(member => {
      const memberItem = document.createElement('li');
      memberItem.className = 'room-member-item';
      
      const isHost = member.role === 'HOST';
      const hostBadge = isHost ? '<span class="host-badge">방장</span>' : '';
      
      memberItem.innerHTML = `
        <div class="member-avatar">${member.name.charAt(0).toUpperCase()}</div>
        <div class="member-name">${member.name} ${hostBadge}</div>
      `;
      
      membersList.appendChild(memberItem);
    });
  } else {
    membersList.innerHTML = '<li class="empty-members">멤버 정보를 불러올 수 없습니다.</li>';
  }
  
  // 활성화된 채팅방 정보 업데이트
  if (activeRoom && activeRoom.id === roomId) {
    activeRoom = {
      ...activeRoom,
      name: response.name,
      hostName: response.hostName,
      members: response.members,
      participantCount: response.members.length
    };
    
    // UI 업데이트
    document.getElementById('chatTitle').textContent = response.name;
    document.getElementById('chatMembers').textContent = `참여자 ${response.members.length}명`;
  }
} catch (error) {
  console.error('채팅방 정보 로드 오류:', error);
}
}

// 코드 메시지 전송
function sendCodeMessage() {
if (!currentRoomId || !isConnected || !stompClient) return;

// 코드 입력 모달 표시
const codeModal = document.createElement('div');
codeModal.className = 'modal-backdrop';
codeModal.style.display = 'flex';

codeModal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title">코드 메시지 전송</h3>
      <button class="modal-close" id="closeCodeModalBtn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="codeLanguage">언어 선택</label>
        <select class="form-control" id="codeLanguage">
          <option value="plaintext">일반 텍스트</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="csharp">C#</option>
          <option value="cpp">C++</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="sql">SQL</option>
        </select>
      </div>
      <div class="form-group">
        <label for="codeContent">코드 입력</label>
        <textarea class="form-control code-textarea" id="codeContent" rows="10" placeholder="코드를 입력하세요..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="cancelCodeBtn">취소</button>
      <button class="btn btn-primary" id="sendCodeBtn">전송</button>
    </div>
  </div>
`;

document.body.appendChild(codeModal);

// 모달 닫기 및 취소 버튼
document.getElementById('closeCodeModalBtn').addEventListener('click', () => {
  document.body.removeChild(codeModal);
});

document.getElementById('cancelCodeBtn').addEventListener('click', () => {
  document.body.removeChild(codeModal);
});

// 모달 바깥 클릭 시 닫기
codeModal.addEventListener('click', (e) => {
  if (e.target === codeModal) {
    document.body.removeChild(codeModal);
  }
});

// 코드 전송 버튼
document.getElementById('sendCodeBtn').addEventListener('click', () => {
  const language = document.getElementById('codeLanguage').value;
  const code = document.getElementById('codeContent').value.trim();
  
  if (code) {
    const codeMessage = {
      messageType: 'GROUP',
      contentType: 'CODE',
      content: {
        code: code,
        language: language
      }
    };
    
    stompClient.send(`/app/chat/message/${currentRoomId}`, {}, JSON.stringify(codeMessage));
    document.body.removeChild(codeModal);
  } else {
    alert('코드를 입력해주세요.');
  }
});
}

//fake zone

function sendFakeCodeMessage() {
  if (!currentRoomId || !isConnected || !stompClient) return;

  const messageData = {
    messageType: currentRoomId == -1 ? 'PRIVATE' : 'GROUP',
    contentType: 'CODE',
    content: {
      language: "JAVA",  // ⚡ 서버 ENUM에 맞춰야 함
      sourceCode: "console.log('Hello, Talko!');"
    }
  };

  stompClient.send(`/app/chat/message/${currentRoomId}`, {}, JSON.stringify(messageData));
}

function sendFakeImageMessage() {
  if (!currentRoomId || !isConnected || !stompClient) return;

  const messageData = {
    messageType: currentRoomId == -1 ? 'PRIVATE' : 'GROUP',
    contentType: 'IMAGE',
    content: {
      imageUrl: "https://via.placeholder.com/150"  // ⚡ 필드명 변경
    }
  };

  stompClient.send(`/app/chat/message/${currentRoomId}`, {}, JSON.stringify(messageData));
}

function sendFakeFileMessage() {
  if (!currentRoomId || !isConnected || !stompClient) return;

  const messageData = {
    messageType: currentRoomId == -1 ? 'PRIVATE' : 'GROUP',
    contentType: 'FILE',
    content: {
      fileName: "fake-document.pdf",
      fileSize: 123456,
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"  // ⚡ 필드명 변경
    }
  };

  stompClient.send(`/app/chat/message/${currentRoomId}`, {}, JSON.stringify(messageData));
}