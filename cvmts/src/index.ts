import * as toml from 'toml';
import IConfig from './IConfig.js';
import * as fs from 'fs';
import CollabVMServer from './CollabVMServer.js';

import { QemuVmDefinition } from '@wize-logic/superqemu';

import AuthManager from './AuthManager.js';
import WSServer from './net/ws/WSServer.js';
import { User } from './User.js';
import VM from './vm/interface.js';
import VNCVM from './vm/vnc/VNCVM.js';
import GeoIPDownloader from './GeoIPDownloader.js';
import pino from 'pino';
import { Database } from './Database.js';
import { BanManager } from './BanManager.js';
import { QemuVMShim } from './vm/qemu.js';
import { TheProtocolManager } from './protocol/Manager.js';
import { GuacamoleProtocol } from './protocol/GuacamoleProtocol.js';
import { BinRectsProtocol } from './protocol/BinRectsProtocol.js';

let logger = pino();

logger.info('CollabVM Server starting up');

// Parse the config file

let Config: IConfig;

if (!fs.existsSync('config.toml')) {
	logger.error('Fatal error: config.toml not found. Please copy config.example.toml and fill out fields');
	process.exit(1);
}
try {
	var configRaw = fs.readFileSync('config.toml').toString();
	Config = toml.parse(configRaw);
} catch (e) {
	logger.error({err: e}, 'Fatal error: Failed to read or parse the config file');
	process.exit(1);
}

let exiting = false;
let VM: VM;

async function stop() {
	if (exiting) return;
	if (Config.discord.status && Config.discord.status.offlineMsg !== false) {
		let msg = typeof Config.discord.status.offlineMsg === 'string' ? Config.discord.status.offlineMsg : Config.discord.status.offlineMsg.message;
		if (!msg || msg === "") msg = " ";
		//@ts-ignore
		let embed = Config.discord.status.offlineMsg.embed ? {} : undefined;
		//@ts-ignore  Title      -----------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.title) typeof Config.discord.status.offlineMsg.embed.title === 'object' ? embed.title = Config.discord.status.offlineMsg.embed.title.text : embed.title = Config.discord.status.offlineMsg.embed.title;
		//@ts-ignore
		if (embed && Config.discord.status.offlineMsg.embed.title && typeof Config.discord.status.offlineMsg.embed.title === 'object' && Config.discord.status.offlineMsg.embed.title.url) embed.url = Config.discord.status.offlineMsg.embed.title.url;
		//@ts-ignore  Image      -----------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.image) embed.image = { url: Config.discord.status.offlineMsg.embed.image };
		//@ts-ignore  Thumbnail  -----------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.thumbnail) embed.thumbnail = { url: Config.discord.status.offlineMsg.embed.thumbnail };
		//@ts-ignore  Color      -----------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.color) embed.color = Config.discord.status.offlineMsg.embed.color;
		//@ts-ignore  Description-----------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.description) embed.description = Config.discord.status.offlineMsg.embed.description;
		//@ts-ignore  Footer     ------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.footer && typeof Config.discord.status.offlineMsg.embed.footer === 'string') embed.footer = { text: Config.discord.status.offlineMsg.embed.footer };
		//@ts-ignore
		if (embed && Config.discord.status.offlineMsg.embed.footer && typeof Config.discord.status.offlineMsg.embed.footer === 'object' && Config.discord.status.offlineMsg.embed.footer.text) embed.footer = { text: Config.discord.status.offlineMsg.embed.footer.text };
		//@ts-ignore
		if (embed && Config.discord.status.offlineMsg.embed.footer && typeof Config.discord.status.offlineMsg.embed.footer === 'object' && Config.discord.status.offlineMsg.embed.footer.icon) embed.footer.icon_url = Config.discord.status.offlineMsg.embed.footer.icon;
		//@ts-ignore  Author     -----------------------------------
		if (embed && Config.discord.status.offlineMsg.embed.author && typeof Config.discord.status.offlineMsg.embed.author === 'string') embed.author = { name: Config.discord.status.offlineMsg.embed.author };
		//@ts-ignore
		if (embed && Config.discord.status.offlineMsg.embed.author && typeof Config.discord.status.offlineMsg.embed.author === 'object' && Config.discord.status.offlineMsg.embed.author.text) embed.author = { name: Config.discord.status.offlineMsg.embed.footer.text };
		//@ts-ignore
		if (embed && Config.discord.status.offlineMsg.embed.author && typeof Config.discord.status.offlineMsg.embed.author === 'object' && Config.discord.status.offlineMsg.embed.author.icon) embed.author.icon_url = Config.discord.status.offlineMsg.embed.author.icon;
		//@ts-ignore
		if (embed && Config.discord.status.offlineMsg.embed.author && typeof Config.discord.status.offlineMsg.embed.author === 'object' && Config.discord.status.offlineMsg.embed.author.url) embed.author.url = Config.discord.status.offlineMsg.embed.author.url;

		let bodyReq = {
			embeds: [embed],
			content: msg
		}
		await fetch(Config.discord.status.webhookUrl, {
			method: 'POST',
			body: JSON.stringify(bodyReq)
		});
	}
	exiting = true;
	await VM.Stop();
	process.exit(0);
}

async function start() {
	let geoipReader = null;
	if (Config.geoip.enabled) {
		let downloader = new GeoIPDownloader(Config.geoip.directory, Config.geoip.accountID, Config.geoip.licenseKey);
		geoipReader = await downloader.getGeoIPReader();
	}
	// Init the auth manager if enabled
	let auth = Config.auth.enabled ? new AuthManager(Config.auth.apiEndpoint, Config.auth.secretKey) : null;
	// Database and ban manager
	if (Config.bans.cvmban && !Config.mysql.enabled) {
		logger.error('MySQL must be configured to use cvmban.');
		process.exit(1);
	}
	if (!Config.bans.cvmban && !Config.bans.bancmd) {
		logger.warn('Neither cvmban nor ban command are configured. Bans will not function.');
	}
	let db = undefined;
	if (Config.mysql.enabled) {
		db = new Database(Config.mysql);
		await db.init();
	}
	if (Config.discord.status && Config.discord.status.onlineMsg !== false) {
		let msg = typeof Config.discord.status.onlineMsg === 'string' ? Config.discord.status.onlineMsg : Config.discord.status.onlineMsg.message;
		if (!msg || msg === "") msg = " ";
		//@ts-ignore
		let embed = Config.discord.status.onlineMsg.embed ? {} : undefined;
		//@ts-ignore  Title      -----------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.title) typeof Config.discord.status.onlineMsg.embed.title === 'object' ? embed.title = Config.discord.status.onlineMsg.embed.title.text : embed.title = Config.discord.status.onlineMsg.embed.title;
		//@ts-ignore
		if (embed && Config.discord.status.onlineMsg.embed.title && typeof Config.discord.status.onlineMsg.embed.title === 'object' && Config.discord.status.onlineMsg.embed.title.url) embed.url = Config.discord.status.onlineMsg.embed.title.url;
		//@ts-ignore  Image      -----------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.image) embed.image = { url: Config.discord.status.onlineMsg.embed.image };
		//@ts-ignore  Thumbnail  -----------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.thumbnail) embed.thumbnail = { url: Config.discord.status.onlineMsg.embed.thumbnail };
		//@ts-ignore  Color      -----------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.color) embed.color = Config.discord.status.onlineMsg.embed.color;
		//@ts-ignore  Description-----------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.description) embed.description = Config.discord.status.onlineMsg.embed.description;
		//@ts-ignore  Footer     ------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.footer && typeof Config.discord.status.onlineMsg.embed.footer === 'string') embed.footer = { text: Config.discord.status.onlineMsg.embed.footer };
		//@ts-ignore
		if (embed && Config.discord.status.onlineMsg.embed.footer && typeof Config.discord.status.onlineMsg.embed.footer === 'object' && Config.discord.status.onlineMsg.embed.footer.text) embed.footer = { text: Config.discord.status.onlineMsg.embed.footer.text };
		//@ts-ignore
		if (embed && Config.discord.status.onlineMsg.embed.footer && typeof Config.discord.status.onlineMsg.embed.footer === 'object' && Config.discord.status.onlineMsg.embed.footer.icon) embed.footer.icon_url = Config.discord.status.onlineMsg.embed.footer.icon;
		//@ts-ignore  Author     -----------------------------------
		if (embed && Config.discord.status.onlineMsg.embed.author && typeof Config.discord.status.onlineMsg.embed.author === 'string') embed.author = { name: Config.discord.status.onlineMsg.embed.author };
		//@ts-ignore
		if (embed && Config.discord.status.onlineMsg.embed.author && typeof Config.discord.status.onlineMsg.embed.author === 'object' && Config.discord.status.onlineMsg.embed.author.text) embed.author = { name: Config.discord.status.onlineMsg.embed.footer.text };
		//@ts-ignore
		if (embed && Config.discord.status.onlineMsg.embed.author && typeof Config.discord.status.onlineMsg.embed.author === 'object' && Config.discord.status.onlineMsg.embed.author.icon) embed.author.icon_url = Config.discord.status.onlineMsg.embed.author.icon;
		//@ts-ignore
		if (embed && Config.discord.status.onlineMsg.embed.author && typeof Config.discord.status.onlineMsg.embed.author === 'object' && Config.discord.status.onlineMsg.embed.author.url) embed.author.url = Config.discord.status.onlineMsg.embed.author.url;

		let bodyReq = {
			embeds: [embed],
			content: msg
		}
		await fetch(Config.discord.status.webhookUrl, {
			method: 'POST',
			body: JSON.stringify(bodyReq)
		});
	}
	let banmgr = new BanManager(Config.bans, db);
	switch (Config.vm.type) {
		case 'qemu': {
			// Add QEMU audio args if audio is enabled
			if (Config.qemu.audioEnabled) {
				const { audioId, audioFrequency, audioDevice } = Config.qemu;
				
				if (audioDevice === "hda-duplex") Config.qemu.qemuArgs += " -device ich9-intel-hda";
				Config.qemu.qemuArgs +=
					` -audiodev none,id=${audioId},out.frequency=${audioFrequency},in.frequency=${audioFrequency}` +
					` -device ${audioDevice},audiodev=${audioId}`;
			}

			// Fire up the VM
			let def: QemuVmDefinition = {
				id: Config.collabvm.node,
				command: Config.qemu.qemuArgs,
				snapshot: Config.qemu.snapshots,
				forceTcp: false,
				vncHost: '127.0.0.1',
				vncPort: Config.qemu.vncPort,
				audioEnabled: Config.qemu.audioEnabled,
				audioId: Config.qemu.audioId,
				audioFrequency: Config.qemu.audioFrequency,
				audioDevice: Config.qemu.audioDevice,
			};

			VM = new QemuVMShim(def, Config.qemu.resourceLimits);
			break;
		}
		case 'vncvm': {
			VM = new VNCVM(Config.vncvm);
			break;
		}
		default: {
			logger.error(`Invalid VM type in config: ${Config.vm.type}`);
			process.exit(1);
			return;
		}
	}
	process.on('SIGINT', async () => await stop());
	process.on('SIGTERM', async () => await stop());

	// Register protocol(s) that the server supports
	TheProtocolManager.registerProtocol("guacamole", () => new GuacamoleProtocol);
	TheProtocolManager.registerProtocol("binary1", () => new BinRectsProtocol);

	// Start up the server
	var CVM = new CollabVMServer(Config, VM, banmgr, auth, geoipReader);
	await VM.Start();

	var WS = new WSServer(Config, banmgr);
	WS.on('connect', (client: User) => CVM.connectionOpened(client));
	WS.start();
}
start();
