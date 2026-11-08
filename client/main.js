import { createWsTransport } from "./data/common/WsTransport.js";
import { loadPlace, loadSession } from "./data/common/SessionStore.js";
import { createMatchModel } from "./domain/match/model.js";
import { createScreens } from "./api/common/screens.js";
import { createMessages } from "./api/common/messages.js";
import { createInput } from "./api/common/input.js";

const app = document.querySelector("#app");
const transport = createWsTransport();
const model = createMatchModel();
const place = loadPlace();
const state = {
  link: transport.status(),
  toast: "",
  awaiting: false,
  pending: [],
  moveSeq: 0,
  freshClock: false,
  screen: place.screen,
  listed: place.listed,
  kicked: false,
  autopilot: place.autopilot,
  shellKey: "",
  catalog: { query: place.query, items: [], nextOffset: 0, loading: false },
};
if (loadSession() && state.screen !== "browse" && state.screen !== "create") state.screen = "room";
if (state.screen === "room" && !loadSession()) state.screen = "browse";

const screens = createScreens({ app, transport, model, state });
const messages = createMessages({ transport, model, state, screens });
const input = createInput({ transport, model, state, screens });

transport.onStatus(messages.onStatus);
transport.onMessage(messages.onMessage);
screens.bind(app);
input.bind();
screens.render(true);
