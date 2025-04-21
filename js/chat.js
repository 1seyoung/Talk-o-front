// 채팅 페이지 자바스크립트 (js/chat.js)
document.addEventListener('DOMContentLoaded', function() {
    // 상수 및 변수 정의
    const API_BASE_URL = 'http://localhost:8081/api';
    const chatList = document.getElementById('chatList');
    const searchInput = document.getElementById('searchInput');
    const newChatBtn = document.getElementById('newChatBtn');
    const startChatBtn = document.getElementById('startChatBtn');
    const newChatModal = document.getElementById('newChatModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const roomNameInput = document.getElementById('roomName');
    const logoutBtn = document.getElementById('logout');
    const logoutButton = document.getElementById('logoutButton');
    const dropdowns = document.querySelectorAll('.dropdown');
    let rooms = []; // 채팅방 목록을 저장할 배열
  
    // 사용자 인증 확인
    function checkAuth() {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    }
  
    // 페이지 로드 시 인증 확인
    if (!checkAuth()) {
      return; // 인증 실패 시 함수 종료
    }
  
    // 드롭다운 메뉴 토글 기능 설정
    dropdowns.forEach(dropdown => {
      dropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        const menu = this.querySelector('.dropdown-menu');
        
        // 다른 드롭다운 메뉴 닫기
        dropdowns.forEach(d => {
          if (d !== dropdown) {
            d.querySelector('.dropdown-menu').classList.remove('show');
          }
        });
        
        // 현재 드롭다운 메뉴 토글
        menu.classList.toggle('show');
      });
    });
  
    // 화면 클릭 시 모든 드롭다운 메뉴 닫기
    document.addEventListener('click', function() {
      dropdowns.forEach(dropdown => {
        dropdown.querySelector('.dropdown-menu').classList.remove('show');
      });
    });
  
    // 사용자 정보 설정
    function setUserInfo() {
      const userName = localStorage.getItem('userName') || '사용자';
      const userEmail = localStorage.getItem('userEmail') || '';
      
      document.getElementById('username').textContent = userName;
      
      // 프로필 이미지 이니셜 설정
      const profileImg = document.getElementById('profileImg');
      profileImg.textContent = userName.charAt(0).toUpperCase();
    }
  
    // 채팅방 목록 불러오기
    async function loadChatRooms() {
      try {
        chatList.innerHTML = `
          <div class="loading">
            <div class="loading-spinner"></div>
            <span>채팅방 목록을 불러오는 중...</span>
          </div>
        `;
        
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
          window.location.href = 'login.html';
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/rooms`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('채팅방 목록을 불러오는데 실패했습니다.');
        }
        
        const data = await response.json();
        rooms = data; // 채팅방 데이터 저장
        
        renderChatRooms(rooms);
      } catch (error) {
        console.error('채팅방 목록 로드 오류:', error);
        chatList.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-circle"></i> 채팅방 목록을 불러오는데 실패했습니다.
            <button class="btn btn-primary" style="margin-top: 10px;" id="retryBtn">다시 시도</button>
          </div>
        `;
        
        // 재시도 버튼에 이벤트 리스너 추가
        document.getElementById('retryBtn').addEventListener('click', loadChatRooms);
      }
    }
  
    // 채팅방 목록 렌더링
    function renderChatRooms(roomsToRender) {
      chatList.innerHTML = '';
      
      if (roomsToRender.length === 0) {
        chatList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">
              <i class="fas fa-comments"></i>
            </div>
            <p>채팅방이 없습니다.</p>
            <p>새 채팅방을 만들어 대화를 시작하세요!</p>
          </div>
        `;
        return;
      }
      
      roomsToRender.forEach(room => {
        // 색상 계산 (채팅방 이름에 따라 다른 색상)
        const colors = ['#4e73df', '#1cc88a', '#f6c23e', '#36b9cc', '#e74a3b'];
        const colorIndex = room.id % colors.length;
        const backgroundColor = colors[colorIndex];
        
        // 채팅방 생성/업데이트 시간 형식화
        const updatedAt = new Date(room.updated_at || room.created_at);
        const now = new Date();
        const diffDays = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((now - updatedAt) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((now - updatedAt) / (1000 * 60));
        
        let timeText;
        if (diffDays > 0) {
          timeText = diffDays + '일 전';
        } else if (diffHours > 0) {
          timeText = diffHours + '시간 전';
        } else if (diffMinutes > 0) {
          timeText = diffMinutes + '분 전';
        } else {
          timeText = '방금 전';
        }
        
        const roomElement = document.createElement('div');
        roomElement.className = 'chat-item';
        roomElement.dataset.roomId = room.id;
        roomElement.innerHTML = `
          <div class="chat-avatar" style="background-color: ${backgroundColor}">
            ${room.name.charAt(0).toUpperCase()}
          </div>
          <div class="chat-info">
            <div class="chat-header">
              <div class="chat-name">${room.name}</div>
              <div class="chat-time">${timeText}</div>
            </div>
            <div class="chat-preview">
              ${new Date(room.created_at).toLocaleDateString()} 생성됨
            </div>
          </div>
        `;
        
        roomElement.addEventListener('click', () => {
          // 현재 활성화된 채팅방 비활성화
          document.querySelectorAll('.chat-item.active').forEach(item => {
            item.classList.remove('active');
          });
          
          // 선택한 채팅방 활성화
          roomElement.classList.add('active');
          
          // 채팅방 상세 페이지로 이동하거나 채팅방 내용 표시
          // window.location.href = `chat-room.html?id=${room.id}`;
          // 또는 현재 페이지에서 채팅방 내용 로드
          // loadChatRoom(room.id);
        });
        
        chatList.appendChild(roomElement);
      });
    }
  
    // 새 채팅방 생성
    async function createChatRoom(roomName) {
      try {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
          window.location.href = 'login.html';
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ name: roomName })
        });
        
        if (!response.ok) {
          throw new Error('채팅방 생성에 실패했습니다.');
        }
        
        const newRoom = await response.json();
        
        // 새 채팅방을 목록에 추가하고 다시 렌더링
        rooms.unshift(newRoom);
        renderChatRooms(rooms);
        
        // 모달 닫기
        closeModal();
        
        // 새 채팅방 선택
        setTimeout(() => {
          const newRoomElement = document.querySelector(`.chat-item[data-room-id="${newRoom.id}"]`);
          if (newRoomElement) {
            newRoomElement.click();
          }
        }, 100);
        
        return newRoom;
      } catch (error) {
        console.error('채팅방 생성 오류:', error);
        alert('채팅방 생성에 실패했습니다.');
      }
    }
    
    // 모달 관련 함수
    function openModal() {
      newChatModal.classList.add('show');
      roomNameInput.value = ''; // 입력 필드 초기화
      roomNameInput.focus();
    }
    
    function closeModal() {
      newChatModal.classList.remove('show');
    }
    
    // 검색 기능
    function searchRooms(query) {
      if (!query) {
        renderChatRooms(rooms);
        return;
      }
      
      const filteredRooms = rooms.filter(room => 
        room.name.toLowerCase().includes(query.toLowerCase())
      );
      
      renderChatRooms(filteredRooms);
    }
    
    // 로그아웃 처리
    function logout() {
      const accessToken = localStorage.getItem('accessToken');
      
      // API 호출 (선택 사항)
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }).catch(error => {
        console.error('로그아웃 API 오류:', error);
      }).finally(() => {
        // localStorage에서 모든 사용자 데이터 삭제
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        
        // 로그인 페이지로 리다이렉트
        window.location.href = 'index.html';
      });
    }
  
    // 이벤트 리스너 등록
    newChatBtn.addEventListener('click', openModal);
    startChatBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    createRoomBtn.addEventListener('click', async () => {
      const roomName = roomNameInput.value.trim();
      if (roomName) {
        await createChatRoom(roomName);
      } else {
        alert('채팅방 이름을 입력해주세요.');
      }
    });
    
    searchInput.addEventListener('input', (e) => {
      searchRooms(e.target.value);
    });
    
    // 로그아웃 버튼에 이벤트 리스너 추가
    logoutBtn.addEventListener('click', logout);
    logoutButton.addEventListener('click', logout);
    
    // 모달 외부 클릭 시 닫기
    newChatModal.addEventListener('click', (e) => {
      if (e.target === newChatModal) {
        closeModal();
      }
    });
    
    // Enter 키로 채팅방 생성
    roomNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const roomName = roomNameInput.value.trim();
        if (roomName) {
          createChatRoom(roomName);
        } else {
          alert('채팅방 이름을 입력해주세요.');
        }
      }
    });
  
    // 초기 설정 실행
    setUserInfo();
    loadChatRooms();
  });