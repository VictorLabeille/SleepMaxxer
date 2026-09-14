/**
 * File des commandes : une seule écriture en vol à la fois, dans l'ordre des appuis. Le réveil
 * sature sous une rafale (~25 ko de tas libre) ; le collecteur sérialise déjà, mais l'app ne lui
 * envoie pas de rafale non plus (cadrage §3.A et §3.D).
 */
let tail: Promise<unknown> = Promise.resolve();

export function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}
