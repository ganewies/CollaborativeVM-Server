import { CgroupLimits } from './vm/qemu_launcher';
import VNCVMDef from './vm/vnc/VNCVMDef';

//? null to false (toml doesn't support null :P)
export default interface IConfig {
	http: {
		host: string;
		port: number;
		proxyAllowedIps: string[] | false;
		originAllowedDomains: string[] | false;
	};
	geoip: {
		enabled: boolean;
		directory: string;
		accountID: string;
		licenseKey: string;
	};
	auth: {
		enabled: boolean;
		apiEndpoint: string;
		secretKey: string;
		guestPermissions: { // TODO: change this freaky name from guestPermissions to guestPerms
			chat: boolean;
			turn: boolean;
			callForReset: boolean;
			vote: boolean;
		};
	};
	vm: {
		type: 'qemu' | 'vncvm';
	};
	qemu: {
		qemuArgs: string;
		vncPort: number;
		snapshots: boolean;
		audioEnabled: boolean;
		audioFrequency: 48000 | 44100;
		audioId: string;
		audioDevice: "ac97" | "es1370" | "sb16" | "hda-duplex";
		resourceLimits?: CgroupLimits
	};
	vncvm: VNCVMDef;
	mysql: MySQLConfig;
	bans: BanConfig;
	collaborativevm: {
		node: string;
		displayname: string;
		motd: string;
		thumbnailSize: number;
		screenQuality: number;
		maxConnections: number;
		usernameblacklist: string[];
		maxChatLength: number;
		maxChatHistoryLength: number;
		turnlimit: number | false;
		automute: {
			seconds: number;
			messages: number;
		} | false;
		tempMuteTime: number;
		turnTime: number;
		voteTime: number;
		voteCooldown: number;
		adminpass: string;
		modpass: string|false;
		turnpass: string|false;
		cardRefreshRate: number;
		modPerms: Permissions;
	};
	discord: {
		status?: {
			webhookUrl: string;
			onlineMsg: /*message*/string | false;
			offlineMsg: /*message*/string | false;
			webhookCustomization?: { name?: string; icon?: URL; } | false;
		}

	};
}

export interface MySQLConfig {
	enabled: boolean;
	host: string;
	username: string;
	password: string;
	database: string;
}

export interface BanConfig {
	bancmd: string | string[] | undefined;
	cvmban: boolean;
}

export interface Permissions {
	restore: boolean;
	reboot: boolean;
	ban: boolean;
	forceVote: boolean;
	mute: boolean;
	kick: boolean;
	bypassTurn: boolean;
	indefiniteTurn: boolean;
	rename: boolean;
	grabIP: boolean;
	xss: boolean;
	hideScreen: boolean;
	cutScreen: boolean;
}
