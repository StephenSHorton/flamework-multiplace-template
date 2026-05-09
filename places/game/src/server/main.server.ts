import { BUILD_HASH, BUILD_TIME } from "@common/shared/constants/build";
import { Flamework } from "@flamework/core";

print(`[SERVER] Build: ${BUILD_HASH} (${BUILD_TIME})`);

Flamework.addPaths("places/game/src/server");
Flamework.addPaths("places/common/src/server");

Flamework.ignite();
