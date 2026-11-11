// @sys sim/events: the channel by which a lower layer's act reaches a higher one (target-v2 3.2): `emit` calls the subscribers at once, in load order
VB['sim/events'] = (() => {
  const { atLoad } = VB['sim/registry'];
  // Code, never saved state: kind -> subscribers in the order they registered. Closed with the registries (the first seed or load).
  const subscribers = new Map();
  // A higher module subscribes at load: fn(st, data) runs where the lower module emits, and cannot veto (its return is not read). A command it
  // issues and sees refused changes nothing further (target-v2 4.1, Workflows, rule 4).
  function on(kind, fn) {
    atLoad();
    if (!subscribers.has(kind)) subscribers.set(kind, []);
    subscribers.get(kind).push(fn);
  }
  // Nothing allocated here beyond the caller's `data`.
  function emit(st, kind, data) {
    const list = subscribers.get(kind);
    if (list === undefined) return;
    for (let i = 0; i < list.length; i++) list[i](st, data);
  }
  return { on, emit };
})();
