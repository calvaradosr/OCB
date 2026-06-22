export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-ink mb-2">You&apos;re on the list!</h1>
      <p className="text-sm text-muted max-w-xs">
        Thank you for reaching out. A credit specialist will contact you within 1 business day to discuss your options.
      </p>
      <p className="text-xs text-muted/60 mt-8">
        No credit score improvement is guaranteed. Results vary based on individual credit history.
      </p>
    </div>
  )
}
