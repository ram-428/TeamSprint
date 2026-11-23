import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="float grad-text text-[120px] font-bold leading-none">404</div>
      <h1 className="mt-2 text-2xl font-semibold">Lost in orbit</h1>
      <p className="mt-2 max-w-sm text-muted">The page you're looking for doesn't exist or has moved.</p>
      <Link href="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
