/**
 * Shared wrapper so every screen opens the same way — a quiet label above
 * a plain heading, with room to breathe.
 */

export default function Screen({ label, title, children }) {
  return (
    <section className="pt-6">
      {label && <p className="label">{label}</p>}
      <h1 className="mt-2 text-[28px] leading-tight font-medium tracking-tight">{title}</h1>
      {children}
    </section>
  )
}
