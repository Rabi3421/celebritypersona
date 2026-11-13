// Loaded with `node --import ./tests/register.mjs --test …`: lets tests import
// modules that use the "@/..." alias. See tests/alias-hooks.mjs.
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
