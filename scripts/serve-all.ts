import { spawn } from "node:child_process";

function rojoServe(projectPath: string, port: number, label: string) {
	const proc = spawn("rojo", ["serve", "--no-watch", "--port", String(port), projectPath], {
		stdio: "pipe",
		shell: true,
	});

	proc.stdout?.on("data", (chunk) => {
		for (const line of String(chunk).split("\n")) {
			if (line) console.log(`[${label}] ${line}`);
		}
	});
	proc.stderr?.on("data", (chunk) => {
		for (const line of String(chunk).split("\n")) {
			if (line) console.error(`[${label}] ${line}`);
		}
	});
	proc.on("exit", (code) => console.log(`[${label}] exited (${code})`));

	return proc;
}

const lobby = rojoServe("places/lobby/default.project.json", 34872, "lobby");
const game = rojoServe("places/game/default.project.json", 34873, "game");

function shutdown() {
	lobby.kill();
	game.kill();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
