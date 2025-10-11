import * as msgpack from 'msgpackr';
import { CollabVMProtocolMessage, CollabVMProtocolMessageType } from '@cvmts/collab-vm-1.2-binary-protocol';
import { GuacamoleProtocol } from './GuacamoleProtocol.js';

import { ScreenRect } from './Protocol';
import { User } from '../User.js';

export class BinRectsProtocol extends GuacamoleProtocol {
	sendScreenUpdate(user: User, rect: ScreenRect): void {
		let bmsg: CollabVMProtocolMessage = {
			type: CollabVMProtocolMessageType.frame,
			rect: rect
		};
		//@ts-ignore
		user.socket.sendBinary(msgpack.encode(bmsg));
	}

	sendAudioOpus(user: User, opusPacket: Buffer): void {
		if (!user?.socket.isOpen()) return;
		
		try {
		  	let bmsg: CollabVMProtocolMessage = {
				type: CollabVMProtocolMessageType.audioOpus,
				opusPacket: opusPacket
		  	};
		 	const encoded = msgpack.encode(bmsg);
			//@ts-ignore
		  	user.socket.sendBinary(encoded);
		} catch (err) { console.error('[Server] Error sending audioOpus:', err) }
	}
}
