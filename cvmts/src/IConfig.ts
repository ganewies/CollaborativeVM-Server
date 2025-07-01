import { CgroupLimits } from './vm/qemu_launcher';
import VNCVMDef from './vm/vnc/VNCVMDef';

// null to false (toml doesn't support null :P)
export default interface IConfig {
	http: {
		host: string;
		port: number;
		proxying: boolean;
		proxyAllowedIps: string[];
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
		guestPermissions: {
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
	collabvm: {
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
		moderatorPermissions: Permissions;
	};
	discord: {
		status?: {
			webhookUrl: string;
			onlineMsg: /*message*/string | {
				message: string | false;
				embed?: {
					color?: string;
					author?: { text: string; icon?: URL; }
					title?: string | { text: string; url?: URL; };
					thumbnail?: URL;
					description?: string/* | string[]*/; // ill do the array of string later bruh its late on my timezone tho
					image?: URL;
					footer?: string | { text: string; icon?: URL; };
				};
			} | false;
			offlineMsg: /*message*/string | {
				message: string | false;
				embed?: {
					color?: string;
					author?: string | { text: string; icon?: URL; url?: URL; }
					title?: string | { text: string; url?: URL; };
					thumbnail?: URL;
					description?: string;
					image?: URL;
					footer?: string | { text: string; icon?: URL; };
				};
			} | false;
			webhookCustomization?: { name?: string; icon?: URL; };
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
	forcevote: boolean;
	mute: boolean;
	kick: boolean;
	bypassturn: boolean;
	indefiniteturn: boolean;
	rename: boolean;
	grabip: boolean;
	xss: boolean;
}
