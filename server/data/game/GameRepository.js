import { reconcileRooms } from "../../domain/match/match.js";

export async function createGameRepository(store, clock) {
  let state = reconcileRooms(await store.load(), clock.now());
  await store.save(state);
  let chain = Promise.resolve();
  return {
    load() {
      return state;
    },
    commit(next) {
      state = next;
      const snapshot = next;
      chain = chain.then(() => store.save(snapshot));
      return chain;
    },
  };
}
