import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-semibold text-emerald-700"></p>
        <h1 className="mt-2 text-3xl font-bold">head back to the main page!</h1>
        <Button asChild className="mt-6">
          <Link to="/">Back to marketplace</Link>
        </Button>
      </div>
    </div>
  );
}
