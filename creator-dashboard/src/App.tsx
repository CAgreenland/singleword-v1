const metrics = [
  { label: "Total views", value: "2.4M", delta: "+12.4%", period: "vs last 28 days" },
  { label: "Watch time", value: "184k h", delta: "+8.1%", period: "vs last 28 days" },
  { label: "New followers", value: "18.2k", delta: "+3.2%", period: "vs last 28 days" },
  { label: "Est. revenue", value: "$42.8k", delta: "+19.0%", period: "vs last 28 days" },
];

const weekBars = [42, 58, 36, 72, 48, 64, 55];

const recent = [
  { title: "Studio tour — spring setup", type: "Video", views: "128k", date: "Apr 8, 2026" },
  { title: "Weekly vlog #41", type: "Video", views: "89k", date: "Apr 5, 2026" },
  { title: "Newsletter — April", type: "Post", views: "12k", date: "Apr 2, 2026" },
];

const nav = ["Overview", "Content", "Audience", "Revenue"];

function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-content flex-col gap-8 px-5 pt-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between lg:px-10 lg:pt-12">
        <p className="font-serif text-2xl font-bold tracking-tight text-ink md:text-3xl">Creator</p>
        <nav className="flex flex-wrap items-center gap-x-10 gap-y-3 lg:justify-end" aria-label="Main">
          {nav.map((label) => (
            <a
              key={label}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              href="#"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto mt-10 max-w-content px-5 sm:px-8 lg:px-10">
        <hr className="rule-fade" />
      </div>

      <main className="mx-auto max-w-content px-5 pb-20 pt-12 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">Analytics</p>
            <h1 className="mt-3 font-serif text-[clamp(2.25rem,5vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-ink">
              Performance
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-secondary">
              A calm read of how your work travels — views, time, and growth in one place.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-3 lg:justify-end">
            <label className="sr-only" htmlFor="range">
              Date range
            </label>
            <select
              id="range"
              className="cursor-pointer rounded-full border border-hairline bg-canvas px-5 py-3 text-sm text-ink outline-none transition-colors hover:border-ink-muted focus-visible:ring-2 focus-visible:ring-white/30"
              defaultValue="28d"
            >
              <option value="7d">Last 7 days</option>
              <option value="28d">Last 28 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <button
              type="button"
              className="rounded-full border border-white px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-white/[0.06]"
            >
              Export
            </button>
            <button
              type="button"
              className="rounded-full bg-cta-bg px-6 py-3 text-sm font-semibold text-cta-fg shadow-cta transition hover:bg-[#F5F5F5]"
            >
              New report
            </button>
          </div>
        </div>

        <section className="mt-16 grid gap-px bg-hairline-subtle sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
          {metrics.map((m) => (
            <article
              key={m.label}
              className="bg-canvas px-6 py-8 sm:px-5 sm:py-7 lg:px-6"
            >
              <p className="text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">{m.label}</p>
              <p className="mt-4 font-serif text-[clamp(1.75rem,4vw,2.25rem)] font-bold tracking-tight text-ink">
                {m.value}
              </p>
              <p className="mt-3 text-sm text-ink-secondary">{m.delta}</p>
              <p className="mt-1 text-xs text-ink-muted">{m.period}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-3" aria-label="Charts and detail">
          <div className="border border-hairline-subtle p-6 lg:col-span-2 lg:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="font-serif text-xl font-bold tracking-tight text-ink md:text-2xl">Views over time</h2>
              <span className="text-xs uppercase tracking-[0.06em] text-ink-muted">Last 7 days</span>
            </div>
            <div
              className="mt-10 flex h-52 items-end justify-between gap-2 sm:gap-4"
              role="img"
              aria-label="Bar chart of daily views"
            >
              {weekBars.map((h, i) => (
                <div key={i} className="flex h-full min-h-0 flex-1 flex-col items-center justify-end gap-3">
                  <div
                    className="w-full max-w-[2.75rem] rounded-full bg-ink"
                    style={{ height: `${(h / 100) * 11}rem`, opacity: 0.92 }}
                  />
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-ink-muted">
                    {["M", "T", "W", "T", "F", "S", "S"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-hairline-subtle p-6 lg:p-8">
            <h2 className="font-serif text-xl font-bold tracking-tight text-ink md:text-2xl">Top format</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">Where your minutes accumulate.</p>
            <ul className="mt-10 space-y-0">
              <li className="flex items-center justify-between border-b border-hairline-subtle py-4 first:pt-0">
                <span className="text-sm text-ink">Long-form video</span>
                <span className="text-sm font-medium tabular-nums text-ink">68%</span>
              </li>
              <li className="flex items-center justify-between border-b border-hairline-subtle py-4">
                <span className="text-sm text-ink">Shorts</span>
                <span className="text-sm font-medium tabular-nums text-ink">24%</span>
              </li>
              <li className="flex items-center justify-between py-4">
                <span className="text-sm text-ink">Posts & newsletters</span>
                <span className="text-sm font-medium tabular-nums text-ink">8%</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-16" aria-label="Recent content">
          <h2 className="font-serif text-xl font-bold tracking-tight text-ink md:text-2xl">Recent content</h2>
          <div className="mt-6 overflow-x-auto border border-hairline-subtle">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline-subtle text-xs uppercase tracking-[0.06em] text-ink-muted">
                  <th className="px-5 py-4 font-medium">Title</th>
                  <th className="px-5 py-4 font-medium">Type</th>
                  <th className="px-5 py-4 font-medium">Views</th>
                  <th className="px-5 py-4 font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="text-ink-secondary">
                {recent.map((row) => (
                  <tr key={row.title} className="border-b border-hairline-subtle last:border-0">
                    <td className="px-5 py-4 font-medium text-ink">{row.title}</td>
                    <td className="px-5 py-4">{row.type}</td>
                    <td className="px-5 py-4 tabular-nums">{row.views}</td>
                    <td className="px-5 py-4 text-ink-muted">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-content border-t border-hairline-subtle px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">Creator</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-secondary">
              Minimal metrics, clear story — built for focus.
            </p>
          </div>
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center lg:gap-16">
            <div className="flex gap-3" aria-label="Social">
              <a
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:text-ink"
                aria-label="Social link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M4 4l16 16M20 4L4 20" />
                </svg>
              </a>
              <a
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:text-ink"
                aria-label="Social link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </a>
              <a
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:text-ink"
                aria-label="Social link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <polygon points="8 5 19 12 8 19 8 5" />
                </svg>
              </a>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-ink-muted">
              <a className="transition-colors hover:text-ink" href="#">
                Privacy
              </a>
              <a className="transition-colors hover:text-ink" href="#">
                Terms
              </a>
              <a className="transition-colors hover:text-ink" href="#">
                Help
              </a>
            </div>
          </div>
        </div>
        <div className="mt-12">
          <hr className="rule-fade" />
          <p className="mt-8 text-xs text-ink-muted">© 2026 Creator Analytics</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
