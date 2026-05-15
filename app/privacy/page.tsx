export default function PrivacyPage() {
  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto space-y-4 text-sm leading-relaxed text-white/80">
      <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-xs text-amber-300">DRAFT — Marked for legal review before launch.</p>
      <p className="text-xs text-white/40">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="text-lg font-semibold pt-3">1. What We Collect</h2>
      <p>Account info (email), and the data you choose to log: intake events, workouts, substance stack, bloodwork values, practices, custom metrics, photos (only if you opt to upload), and AI-generated reports.</p>

      <h2 className="text-lg font-semibold pt-3">2. How We Store It</h2>
      <p>Data is stored in Supabase (Postgres) with Row-Level Security (RLS) ensuring only you can read your own records. The database is encrypted at rest.</p>

      <h2 className="text-lg font-semibold pt-3">3. AI Processing</h2>
      <p>When you use AI features (food/bloodwork/physique vision, rediagnosis), the relevant data is sent to our third-party AI inference provider. The provider does not retain user data for training under their commercial terms. Each AI recommendation is logged for your audit trail.</p>

      <h2 className="text-lg font-semibold pt-3">4. Payments</h2>
      <p>Stripe processes payments. We do not store credit card numbers. We store your Stripe customer ID and subscription metadata only.</p>

      <h2 className="text-lg font-semibold pt-3">5. Sharing</h2>
      <p>We do NOT sell your data. We do not share it with third parties for advertising. Service providers (Supabase, Anthropic, Stripe, Vercel) process data only as required to operate the Service.</p>

      <h2 className="text-lg font-semibold pt-3">6. Your Rights</h2>
      <p>You can export or delete your data at any time. Email-based requests honored within 30 days.</p>

      <h2 className="text-lg font-semibold pt-3">7. Sensitive Data</h2>
      <p>Health data is sensitive. You choose what to log. Body photos and bloodwork PDFs remain in your private storage bucket; image analysis is ephemeral and the raw image is not retained server-side unless you explicitly save it.</p>

      <h2 className="text-lg font-semibold pt-3">8. Children</h2>
      <p>VITALS is for users 18+. We do not knowingly collect data from minors.</p>

      <h2 className="text-lg font-semibold pt-3">9. Changes</h2>
      <p>If we materially change how we use your data, we'll notify you in-app before the change takes effect.</p>

      <h2 className="text-lg font-semibold pt-3">10. Contact</h2>
      <p>For privacy questions, use the in-app feedback channel.</p>
    </div>
  )
}
