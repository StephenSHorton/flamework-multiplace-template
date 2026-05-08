import { Flamework } from "@flamework/core";
import { BUILD_HASH, BUILD_TIME } from "@common/shared/constants/build";

print(`[SERVER] Build: ${BUILD_HASH} (${BUILD_TIME})`);

Flamework.addPaths("places/game/src/server");
Flamework.addPaths("places/common/src/server");

Flamework.ignite();
