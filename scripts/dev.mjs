// Refuse to start a second dev server for this project.
//
// Two `next dev` processes in one directory share `.next` — the same `static/`, the same
// build manifests, the same `cache/webpack`. Each one's in-memory manifest then disagrees
// with the chunks the other just overwrote, so assets 404 or, worse, `layout.css` gets
// rewritten with zero Tailwind utilities and the whole site renders unstyled. A bare
// `next dev` silently falls forward to the next free port ("Port 3000 is in use, using
// 3005 instead") when 3000 is taken, which is how the second writer gets created without
// anyone noticing. So: pin the port, and check it first to fail with a useful message.
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const PORT = Number(process.env.PORT || 3000);

// No host argument, so Node binds the same dual-stack `::` wildcard `next dev` does.
// Probing `0.0.0.0` explicitly reports a port free that Next then fails to bind.
const portIsFree = (port) =>
  new Promise((resolve) => {
    const probe = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port);
  });

if (!(await portIsFree(PORT))) {
  console.error(
    [
      '',
      `  A dev server is already listening on http://localhost:${PORT}.`,
      '',
      "  Not starting a second one: two `next dev` processes share this project's .next",
      "  directory and corrupt each other's build output. The usual symptom is the site",
      '  rendering with no CSS at all.',
      '',
      '  Use the server that is already running, or, to work in parallel, create a git',
      '  worktree so the second server gets its own .next:',
      '',
      '    git worktree add ../icc-eweb-2 -b my-branch',
      '',
      '  If you really do want a second server in this directory, run `npm run dev:force`.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');

spawn(process.execPath, [nextBin, 'dev', '--port', String(PORT)], {
  stdio: 'inherit',
}).on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
