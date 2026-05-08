import { Flamework } from "@flamework/core";
import { BUILD_HASH, BUILD_TIME } from "@common/shared/constants/build";

print(`[CLIENT] Build: ${BUILD_HASH} (${BUILD_TIME})`);

Flamework.addPaths("places/lobby/src/client");
Flamework.addPaths("places/common/src/client");

Flamework.ignite();
