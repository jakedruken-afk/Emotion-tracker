import BrandMark from "../components/BrandMark";

type NotFoundPageProps = {
  onLogout: () => void;
};

export default function NotFoundPage({ onLogout }: NotFoundPageProps) {
  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-lg">
        <div className="panel p-8 text-center">
          <BrandMark variant="compact" align="center" className="justify-center" />
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">Unknown Role</p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">We could not load this dashboard.</h1>
          <p className="mt-3 text-slate-600">
            The saved login state did not match a supported role. Sign out and log in again.
          </p>
          <button type="button" className="btn btn-primary mt-6" onClick={onLogout}>
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
