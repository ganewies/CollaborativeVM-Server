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

import { Client as Webhook } from '@ifiib/webhook';

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
let webhook: Webhook;

async function stop() {
	if (exiting) return;
	if (Config.discord.status && Config.discord.status.offlineMsg !== false) webhook.send({ content: Config.discord.status.offlineMsg });
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
	if (Config.discord.status) webhook = new Webhook(Config.discord.status.webhookUrl);
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
	if (Config.discord.status && Config.discord.status.onlineMsg !== false) webhook.send({ content: Config.discord.status.onlineMsg });
	let banmgr = new BanManager(Config.bans, db);
	switch (Config.vm.type) {
		case 'qemu': {
			// Add QEMU audio args if audio is enabled
			if (Config.qemu.audioEnabled) {
				const { audioId, audioFrequency, audioDevice } = Config.qemu;
				
				if (audioDevice === "hda-duplex") Config.qemu.qemuArgs += " -device ich9-intel-hda"; // else kaboom
				Config.qemu.qemuArgs +=
					` -audiodev none,id=${audioId},out.frequency=${audioFrequency},in.frequency=${audioFrequency}` +
					` -device ${audioDevice},audiodev=${audioId}`;
			}
			// da usb tablet
			Config.qemu.qemuArgs += " -device qemu-xhci -device usb-tablet"

			// Fire up the VM
			let def: QemuVmDefinition = {
				id: Config.collaborativevm.node,
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
