// 전역 변수
let currentRoomId = null;
let rooms = [];
let invitations = [];
let activeRoom = null;

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
  
  // 사용자 정보 표시
  document.getElementById('username').textContent = userName;
  document.getElementById('profileImg').textContent = userName.charAt(0).toUpperCase();
  
  // 초기 데이터 로드
  loadChatRooms();
  loadInvitations();
  
  // 이벤트 리스너 설정
  setupEventListeners();
});

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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  });
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

// 채팅방 목록 렌더링
function renderChatRooms(roomList) {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '';
  
  roomList.forEach(room => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.roomId = room.id;
    
    // 첫 글자를 가져와 아바타로 사용
    const firstChar = room.name.charAt(0).toUpperCase();
    
    chatItem.innerHTML = `
      <div class="chat-avatar">${firstChar}</div>
      <div class="chat-details">
        <div class="chat-name">${room.name}</div>
        <div class="chat-participants">참여자 ${room.participantCount}명</div>
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
  loadRoomInfo(room.id);
  
  // 채팅 UI 보이기
  document.getElementById('welcomeMessage').style.display = 'none';
  document.getElementById('chatContainer').style.display = 'flex';
  
  // 채팅방 정보 표시
  document.getElementById('chatTitle').textContent = room.name;
  document.getElementById('chatMembers').textContent = `참여자 ${room.participantCount}명`;
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
    const pendingInvitations = invitations.filter(invite => invite.status.toLowerCase() === 'pending');
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
      
      switch (invitation.status.toLowerCase) {
        case 'pending':
          statusText = '대기 중';
          actionButtons = `
            <div class="invitation-actions">
              <button class="btn btn-success accept-btn" data-invitation-id="${invitation.invitationId}">수락</button>
              <button class="btn btn-danger reject-btn" data-invitation-id="${invitation.invitationId}">거절</button>
            </div>
          `;
          break;
        case 'accepted':
          statusText = '수락됨';
          break;
        case 'rejected':
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
    
    if (response) {
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
    
    if (response) {
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
    document.getElementById('roomInfoMemberCount').textContent = response.participantCount;
    
    // 멤버 목록 렌더링
    const membersList = document.getElementById('roomMembersList');
    membersList.innerHTML = '';
    
    response.members.forEach(member => {
      const memberItem = document.createElement('li');
      memberItem.className = 'room-member-item';
      
      const isHost = member.userId === response.hostId;
      const hostBadge = isHost ? '<span class="host-badge">방장</span>' : '';
      
      memberItem.innerHTML = `
        <div class="member-avatar">${member.name.charAt(0).toUpperCase()}</div>
        <div class="member-name">${member.name} ${hostBadge}</div>
      `;
      
      membersList.appendChild(memberItem);
    });
  } catch (error) {
    console.error('채팅방 정보 로드 오류:', error);
  }
}