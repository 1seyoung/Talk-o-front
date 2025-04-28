// 메시지 전송 함수 - 서버에서 기대하는 형식으로 수정
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentRoomId || !stompClient || !isConnected) return;
    
    // 서버에 보내는 메시지 구조를 확인하기 위해 로그 출력
    console.log("전송 메시지 구조:", {
      messageType: 'GROUP',
      contentType: 'TEXT',
      content: {
        text: message
      }
    });
    
    const messageData = {
      messageType: 'GROUP',
      contentType: 'TEXT',
      content: {
        text: message
      }
    };
    
    stompClient.send(`/app/chat/message/${currentRoomId}`, {}, JSON.stringify(messageData));
    
    messageInput.value = '';
    messageInput.focus();
  }
  
  // 수신된 메시지 처리 함수 - 서버 응답 구조 확인용 로그 추가
  function handleIncomingMessage(message, roomId) {
    if (roomId !== currentRoomId) return;
  
    try {
      const messageData = JSON.parse(message.body);
      console.log('메시지 수신(원본):', messageData);
      console.log('메시지 내용 타입:', typeof messageData.content);
      
      // 현재 사용자 ID와 비교하여 발신자 확인
      messageData.isCurrentUser = messageData.senderId === parseInt(currentUser.id);
  
      // 메시지 타입에 따라 처리
      switch (messageData.contentType) {
        case 'TEXT':
          displayTextMessage(messageData);
          break;
        // 다른 케이스들...
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
    }
  }
  
  // 텍스트 메시지 표시 함수 - 서버가 보내는 형식에 맞게 수정
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
    
    // 콘텐츠 형식에 따라 텍스트 추출
    let textContent;
    
    // 구조 디버깅용 로그
    console.log('메시지 콘텐츠:', messageData.content);
    
    if (typeof messageData.content === 'string') {
      textContent = messageData.content;
    } else if (messageData.content && typeof messageData.content.text === 'string') {
      textContent = messageData.content.text;
    } else if (messageData.content && messageData.content.value) {
      textContent = messageData.content.value;
    } else if (messageData.text) {
      textContent = messageData.text;
    } else {
      // 전체 메시지 데이터를 문자열로 표시 (디버깅용)
      textContent = JSON.stringify(messageData);
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