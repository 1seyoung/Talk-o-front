// 웹소켓 연결 관리 및 메시지 처리를 위한 클래스
class WebSocketManager {
    constructor() {
      this.stompClient = null;
      this.connected = false;
      this.subscriptions = {};
      this.currentRoomId = null;
      this.messageHandlers = {};
    }
  
    // 웹소켓 연결
    connect(onConnectCallback) {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        console.error('인증 토큰이 없습니다. 로그인이 필요합니다.');
        return;
      }
  
      // SockJS와 STOMP 클라이언트 설정
      const socket = new SockJS('http://localhost:8081/ws');
      this.stompClient = Stomp.over(socket);
      this.stompClient.debug = null; // 개발 시에만 주석 해제 (디버그 활성화)
  
      // 헤더에 인증 토큰 추가
      const headers = {
        'Authorization': `Bearer ${accessToken}`
      };
  
      // 연결 시도
      this.stompClient.connect(
        headers,
        (frame) => {
          console.log('웹소켓 연결 성공:', frame);
          this.connected = true;
          if (onConnectCallback) onConnectCallback();
        },
        (error) => {
          console.error('웹소켓 연결 실패:', error);
          // 몇 초 후 재연결 시도
          setTimeout(() => this.connect(onConnectCallback), 5000);
        }
      );
    }
  
    // 채팅방 입장
    enterRoom(roomId) {
      if (!this.connected || !this.stompClient) {
        console.error('웹소켓이 연결되지 않았습니다.');
        return;
      }
  
      this.currentRoomId = roomId;
      
      // 이전 구독이 있으면 해제
      if (this.subscriptions[roomId]) {
        this.unsubscribe(roomId);
      }
  
      // 채팅방 입장 메시지 전송
      this.stompClient.send(`/app/chat/enter/${roomId}`, {}, JSON.stringify({}));
      
      // 채팅방 메시지 구독
      this.subscribe(roomId);
    }
  
    // 특정 채팅방 구독
    subscribe(roomId) {
      if (!this.connected || !this.stompClient) {
        console.error('웹소켓이 연결되지 않았습니다.');
        return;
      }
  
      // 그룹 채팅 메시지 구독 (topic)
      const groupSubscription = this.stompClient.subscribe(
        `/topic/chat/room/${roomId}`,
        (message) => this.handleIncomingMessage(message, roomId)
      );
  
      // 개인 메시지 구독 (user/queue)
      const userId = localStorage.getItem('userId');
      const privateSubscription = this.stompClient.subscribe(
        `/user/${userId}/queue/chat`,
        (message) => this.handleIncomingMessage(message, roomId)
      );
  
      // 구독 정보 저장
      this.subscriptions[roomId] = {
        group: groupSubscription,
        private: privateSubscription
      };
    }
  
    // 구독 해제
    unsubscribe(roomId) {
      if (this.subscriptions[roomId]) {
        if (this.subscriptions[roomId].group) {
          this.subscriptions[roomId].group.unsubscribe();
        }
        if (this.subscriptions[roomId].private) {
          this.subscriptions[roomId].private.unsubscribe();
        }
        delete this.subscriptions[roomId];
      }
    }
  
    // 메시지 전송
    sendMessage(roomId, messageType, contentType, content) {
      if (!this.connected || !this.stompClient) {
        console.error('웹소켓이 연결되지 않았습니다.');
        return;
      }
  
      const message = {
        messageType: messageType, // GROUP, PRIVATE, SYSTEM, BOT
        contentType: contentType, // TEXT, CODE, IMAGE, FILE
        content: content
      };
  
      this.stompClient.send(`/app/chat/message/${roomId}`, {}, JSON.stringify(message));
    }
  
    // 텍스트 메시지 보내기
    sendTextMessage(roomId, text) {
      this.sendMessage(roomId, 'GROUP', 'TEXT', text);
    }
  
    // 코드 메시지 보내기
    sendCodeMessage(roomId, code, language) {
      const codeData = {
        code: code,
        language: language || 'plaintext'
      };
      this.sendMessage(roomId, 'GROUP', 'CODE', codeData);
    }
  
    // 이미지 메시지 보내기 (TODO)
    sendImageMessage(roomId, imageData) {
      // 이미지 업로드 및 메시지 전송 로직
      this.sendMessage(roomId, 'GROUP', 'IMAGE', imageData);
    }
  
    // 파일 메시지 보내기 (TODO)
    sendFileMessage(roomId, fileData) {
      // 파일 업로드 및 메시지 전송 로직
      this.sendMessage(roomId, 'GROUP', 'FILE', fileData);
    }
  
    // 수신된 메시지 처리
    handleIncomingMessage(message, roomId) {
      try {
        const messageData = JSON.parse(message.body);
        console.log('메시지 수신:', messageData);
  
        // 등록된 메시지 핸들러 호출
        if (this.messageHandlers[messageData.contentType]) {
          this.messageHandlers[messageData.contentType](messageData, roomId);
        } else {
          console.warn('처리되지 않은 메시지 타입:', messageData.contentType);
        }
      } catch (error) {
        console.error('메시지 처리 오류:', error);
      }
    }
  
    // 메시지 타입별 핸들러 등록
    registerMessageHandler(contentType, handler) {
      this.messageHandlers[contentType] = handler;
    }
  
    // 연결 종료
    disconnect() {
      if (this.stompClient) {
        // 모든 구독 해제
        Object.keys(this.subscriptions).forEach(roomId => {
          this.unsubscribe(roomId);
        });
  
        // 연결 종료
        this.stompClient.disconnect();
        this.stompClient = null;
        this.connected = false;
        console.log('웹소켓 연결이 종료되었습니다.');
      }
    }
  }
  
  // 전역 웹소켓 매니저 인스턴스 생성
  const webSocketManager = new WebSocketManager();