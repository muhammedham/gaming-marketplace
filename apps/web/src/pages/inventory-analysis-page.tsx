import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clipboard, CloudUpload, ListChecks, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { inventoryAnalysisApi, uploadToR2 } from "../features/inventory-analysis/api";
import { cleanInventoryResult, formatInventoryGroups } from "../features/inventory-analysis/result-format";
import { MarketplaceState } from "../features/listings/marketplace-state";

const activeStatuses = new Set(["QUEUED", "PROCESSING"]);

function resultText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function InventoryAnalysisPage() {
  const { listingId = "" } = useParams();
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"inventory" | "raw" | null>(null);
  const query = useQuery({
    queryKey: ["inventory-analysis", listingId],
    queryFn: () => inventoryAnalysisApi.overview(listingId),
    enabled: Boolean(listingId),
    refetchInterval: (current) => activeStatuses.has(current.state.data?.latest?.status ?? "") ? 3_000 : false,
  });
  const upload = useMutation({
    mutationFn: async (video: File) => {
      setProgress(0);
      const target = await inventoryAnalysisApi.requestUpload(listingId, video);
      await uploadToR2(video, target, setProgress);
      setProgress(100);
      return inventoryAnalysisApi.completeUpload(target.analysis.id);
    },
    onSuccess: async () => {
      setFile(null);
      await client.invalidateQueries({ queryKey: ["inventory-analysis", listingId] });
    },
  });

  if (query.isPending) return <MarketplaceState kind="loading" title="Preparing inventory analysis" description="Checking the listing and secure upload service." />;
  if (query.isError || !query.data) return <MarketplaceState kind="error" title="Inventory analysis unavailable" description={query.error?.message ?? "The analysis page could not be loaded."} />;

  const overview = query.data;
  const latest = overview.latest;
  const isProcessing = latest && activeStatuses.has(latest.status);
  const result = latest?.output ?? latest?.rawResponse;
  const inventoryGroups = cleanInventoryResult(result);
  const inventoryText = formatInventoryGroups(inventoryGroups);
  const detectedSkinCount = inventoryGroups.reduce((total, group) => total + group.skins.length, 0);

  async function copyResult(value: string, kind: "inventory" | "raw") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  if (!overview.eligible) {
    return <MarketplaceState kind="error" title="This listing is not eligible" description="Inventory analysis is currently available only for listings that use the Accounts category and Valorant game." />;
  }

  function chooseFile(next: File | null) {
    setFileError(null);
    if (!next) return setFile(null);
    if (!overview.acceptedTypes.includes(next.type)) {
      setFile(null);
      setFileError("Choose an MP4 or WebM video.");
      return;
    }
    if (next.size > overview.maxSizeBytes) {
      setFile(null);
      setFileError("The video must be 150 MB or smaller.");
      return;
    }
    setFile(next);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild size="sm" variant="ghost"><Link to={`/listings/${listingId}`}><ArrowLeft className="size-4" />Skip and view listing</Link></Button>
      <header className="mt-5 rounded-2xl bg-[#0D2149] p-6 text-[#FEF5EF] sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#FEF5EF]/80"><Sparkles className="size-4" />Optional Valorant assistant</p>
        <h1 className="mt-2 text-3xl font-bold">Analyze the inventory video</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#FEF5EF]/75">Upload a short walkthrough of the Valorant inventory. The model will extract the detected account items so you do not have to type every skin manually.</p>
      </header>

      {(!overview.integrationConfigured || !overview.storageConfigured) ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <strong>Analyzer setup is incomplete.</strong>
          <p className="mt-1">{!overview.integrationConfigured ? "An Admin must save and enable the Valorant inference API URL. " : ""}{!overview.storageConfigured ? "The API server also needs its private Cloudflare R2 environment variables." : ""}</p>
          <Button asChild className="mt-4" variant="secondary"><Link to={`/listings/${listingId}`}>Continue without analysis</Link></Button>
        </div>
      ) : null}

      {overview.integrationConfigured && overview.storageConfigured && isProcessing ? (
        <section className="mt-6 rounded-xl border border-[#912F56]/20 bg-white p-8 text-center shadow-sm" aria-live="polite">
          <LoaderCircle className="mx-auto size-12 animate-spin text-[#912F56]" />
          <h2 className="mt-4 text-xl font-bold">Please wait while we inspect the video</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#758173]">Analysis time depends on the video and model availability. There is no automatic time limit, and the result updates automatically.</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#912F56]">{latest.status === "QUEUED" ? "Waiting for the analyzer" : "The inventory service is processing the video"}</p>
        </section>
      ) : null}

      {overview.integrationConfigured && overview.storageConfigured && !isProcessing ? (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-6 text-[#912F56]" />
            <div>
              <h2 className="text-lg font-bold">Private temporary upload</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">MP4 or WebM, maximum 150 MB. The original video is automatically removed from private storage two hours after the upload session starts.</p>
            </div>
          </div>
          <label className="mt-5 block rounded-xl border-2 border-dashed border-[#758173]/40 bg-[#FEF5EF] p-6 text-center transition hover:border-[#912F56]">
            <CloudUpload className="mx-auto size-9 text-[#0D2149]" />
            <span className="mt-2 block font-semibold">Choose a Valorant inventory video</span>
            <span className="mt-1 block text-xs text-gray-500">The upload goes directly from your browser to Cloudflare R2.</span>
            <input className="mt-4 block w-full text-sm" type="file" accept="video/mp4,video/webm" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          </label>
          {file ? <p className="mt-3 text-sm"><strong>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(1)} MB</p> : null}
          {fileError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{fileError}</p> : null}
          {upload.isPending ? (
            <div className="mt-4" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full bg-[#912F56] transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-sm text-gray-600">Uploading securely… {progress}%</p>
            </div>
          ) : null}
          {upload.isError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{upload.error.message}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={!file || upload.isPending} onClick={() => file && upload.mutate(file)}><Sparkles className="size-4" />{upload.isPending ? "Uploading..." : "Upload and analyze"}</Button>
            <Button asChild variant="secondary"><Link to={`/listings/${listingId}`}>Skip for now</Link></Button>
          </div>
        </section>
      ) : null}

      {latest?.status === "COMPLETED" ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center gap-2"><CheckCircle2 className="size-6 text-emerald-700" /><div><h2 className="text-lg font-bold">Detected Valorant inventory</h2><p className="text-xs text-emerald-800/75">{detectedSkinCount} unique skin{detectedSkinCount === 1 ? "" : "s"} across {inventoryGroups.length} weapon{inventoryGroups.length === 1 ? "" : "s"}</p></div></div>
            {inventoryGroups.length ? <Button size="sm" variant="secondary" onClick={() => copyResult(inventoryText, "inventory")}><Clipboard className="size-4" />{copied === "inventory" ? "Copied" : "Copy inventory list"}</Button> : null}
          </div>
          <div className="p-5 sm:p-6">
            {inventoryGroups.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {inventoryGroups.map((group) => (
                  <article className="overflow-hidden rounded-xl border border-[#758173]/25 bg-[#FEF5EF]" key={group.weapon}>
                    <h3 className="flex items-center gap-2 bg-[#0D2149] px-4 py-3 font-bold text-[#FEF5EF]"><ListChecks className="size-4 text-[#FEF5EF]/75" />{group.weapon}</h3>
                    <ol className="list-decimal space-y-2 px-9 py-4 text-sm text-[#191102] marker:font-semibold marker:text-[#912F56]">
                      {group.skins.map((skin) => <li key={skin}>{skin}</li>)}
                    </ol>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The analysis completed, but no valid title detections were found in the returned frames.</p>
            )}
            <p className="mt-4 text-xs leading-5 text-gray-500">Repeated detections were removed across all frames. The last word is treated as the weapon name; preceding words are treated as the skin name.</p>
            <details className="mt-5 rounded-lg border border-gray-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700">View raw model response</summary>
              <div className="border-t border-gray-200 p-4">
                <Button size="sm" variant="secondary" onClick={() => copyResult(resultText(result), "raw")}><Clipboard className="size-4" />{copied === "raw" ? "Copied" : "Copy raw result"}</Button>
                <pre className="mt-3 max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-4 text-xs leading-6 text-gray-100">{resultText(result)}</pre>
              </div>
            </details>
          </div>
        </section>
      ) : null}

      {latest?.status === "FAILED" || latest?.status === "EXPIRED" ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><strong>Analysis did not complete.</strong> {latest.errorMessage ?? "Choose the video again and retry."}</p>
      ) : null}
    </div>
  );
}
