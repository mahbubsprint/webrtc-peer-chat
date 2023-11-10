let APP_ID = '3c377b7f8dd44571960927981d84f8bc'
let token = null
let uid = String(Math.floor(Math.random() * 1000));
let client;
let channel

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

let localStream; //store the local user camere, micorophone data
let remoteStream; //store remote user camera, microphone data
let peerConnection; // Peer connection data while create a offer


//Create stun server available in github https://gist.github.com/zziuni/3741933
const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}
let constraints = {
    video:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080},
    },
    audio:true
}

let init = async ()=>{
    //create instance of AforaRtm to pass signal
    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid, token});
    //peer will communicate through a channel
    channel = client.createChannel(roomId);
    await channel.join();

    //event whenever a peer jonin to the channel
    channel.on("MemberJoined", handleUserJoined);

    channel.on("MemberLeft", handleUserLeft);

    //whenever a message come from a peer
    client.on('MessageFromPeer', handleMessageFromPeer)

    //accessing local camera and audio
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    //storing local  video src data
    document.getElementById("user-1").srcObject = localStream;
    //console.dir( document.getElementById("user-1"));
   
}

let handleMessageFromPeer = async (message, MemberId) =>{
     message = JSON.parse(message.text);

    //handel this When a peer has a offer
    if(message.type == "offer"){
        createAnswer(MemberId, message.offer);
    }

    //handel this When a peer has a answer
    if(message.type == "answer"){
        addAnswer(message.answer);
    }

    if(message.type == "candidate"){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

let handleUserJoined = async (MemberId) =>{
    //console.log('New member joined and id is: '+ MemberId);
    createOffer(MemberId);
}

let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')
}

let createPeerConnection = async (MemberId) =>{
    //passing stun servers to  RTCPeerConnection wich will give ip, port
    peerConnection = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();
    document.getElementById("user-2").srcObject = remoteStream;
    document.getElementById("user-2").style.display= "block";
    document.getElementById('user-1').classList.add('smallFrame')
    //get all the localStream track and loop through and send it to peers
    if(!localStream){
        //accessing local camera and audio
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        //storing local  video src data
        document.getElementById("user-1").srcObject = localStream;
    }

    localStream.getTracks().forEach((track) =>{
        //sending local track to peers
        peerConnection.addTrack(track, localStream);
    })

    //event listener when our remote peer in on track the set the track to remote stream 
    peerConnection.ontrack = (event)=>{
        event.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack(track);
        })
    }
    
    // console.log(localStream.getTracks());

    //whenever we create an offer and  setLocalDescription, it will start requesting to
    //stun server and will generate some icecandidate  

    peerConnection.onicecandidate = async (event) =>{
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':"candidate", 'candidate': event.candidate})}, MemberId)
        }
    }
}

//Make a offer to remote peer
let createOffer = async (MemberId) =>{
    await createPeerConnection(MemberId);

    //creating a offer
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    //sending offer message to remote peer
    client.sendMessageToPeer({text:JSON.stringify({'type':"offer", 'offer': offer})}, MemberId)
}

//Make a answer who send request to join
// this method will need the memberId (who requested to join), with offer object

let createAnswer = async (MemberId, offer) =>{
    //Create peer connection

    await createPeerConnection(MemberId);

    //Need to set remote descript tion with offer
    await peerConnection.setRemoteDescription(offer)

    //create answer
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer)

    //sending answer message to remote peer
    client.sendMessageToPeer({text:JSON.stringify({'type':"answer", 'answer': answer})}, MemberId)

}

let addAnswer = (answer) =>{
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer);
    }
}

//When user leave channel
let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}
//This will be called before loading the app
window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()