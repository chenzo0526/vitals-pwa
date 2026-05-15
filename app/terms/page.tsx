export default function TermsPage() {
  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto space-y-4 text-sm leading-relaxed text-white/80">
      <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-xs text-amber-300">DRAFT — Marked for legal review before launch.</p>
      <p className="text-xs text-white/40">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="text-lg font-semibold pt-3">1. Acceptance</h2>
      <p>By accessing or using VITALS ("the Service"), you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

      <h2 className="text-lg font-semibold pt-3">2. Not Medical Advice</h2>
      <p>VITALS is a personal information and tracking tool. It is NOT a medical device, clinical service, or substitute for professional medical advice, diagnosis, or treatment. AI-generated insights are informational only.</p>
      <p>Always seek the advice of a qualified healthcare practitioner with any questions you may have regarding a medical condition, medication, hormone, peptide, or supplement.</p>

      <h2 className="text-lg font-semibold pt-3">3. Eligibility</h2>
      <p>You must be at least 18 years old to use VITALS. By using the Service you represent that you are of legal age.</p>

      <h2 className="text-lg font-semibold pt-3">4. User Responsibilities</h2>
      <p>You are solely responsible for: (a) the accuracy of data you enter, (b) any substances, protocols, or interventions you undertake, (c) consulting qualified clinicians before acting on tracked patterns or AI suggestions.</p>

      <h2 className="text-lg font-semibold pt-3">5. AI Output</h2>
      <p>AI-generated content may contain errors, omissions, or out-of-date information. VITALS will not name specific drug doses for standalone users; recommendations are framed as information for clinician discussion. You agree to use AI output only as a discussion starting point.</p>

      <h2 className="text-lg font-semibold pt-3">6. Subscriptions and Payment</h2>
      <p>Paid plans (Pro, Premium) are billed monthly or yearly via Stripe. You may cancel anytime; cancellation takes effect at the end of the current billing period. Trials convert to Free on day 14 unless upgraded.</p>

      <h2 className="text-lg font-semibold pt-3">7. Data and Privacy</h2>
      <p>See our Privacy Policy. Your tracked data is encrypted at rest in Supabase with row-level security; only you can access your own records.</p>

      <h2 className="text-lg font-semibold pt-3">8. Disclaimer of Warranties</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. VITALS DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR DIAGNOSTICALLY ACCURATE.</p>

      <h2 className="text-lg font-semibold pt-3">9. Limitation of Liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, VITALS AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, USE, OR PROFITS.</p>

      <h2 className="text-lg font-semibold pt-3">10. Changes</h2>
      <p>We may update these Terms; continued use after updates constitutes acceptance.</p>

      <h2 className="text-lg font-semibold pt-3">11. Contact</h2>
      <p>Questions: contact via the in-app feedback channel.</p>
    </div>
  )
}
