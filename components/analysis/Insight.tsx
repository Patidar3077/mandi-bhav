"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n/client";

type Insight = { summary: string; factors: string[] } | null;

// Both the summary line and the factors list read the same request.
const cache = new Map<string, Promise<Insight>>();
function load(url: string) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.json() : { insight: null }))
        .then((d: { insight: Insight }) => d.insight)
        .catch(() => null),
    );
  }
  return cache.get(url)!;
}

function useInsight(url: string) {
  const [state, setState] = useState<{ loading: boolean; insight: Insight }>({ loading: true, insight: null });
  useEffect(() => {
    let alive = true;
    load(url).then((insight) => alive && setState({ loading: false, insight }));
    return () => {
      alive = false;
    };
  }, [url]);
  return state;
}

export function InsightLine({ url }: { url: string }) {
  const { t } = useI18n();
  const { loading, insight } = useInsight(url);
  if (!loading && !insight?.summary) return null;
  return (
    <p className="flex items-start gap-2 text-[15px] font-semibold text-leaf-deep">
      <Icon name="insights" className="mt-0.5 text-[20px]" />
      <span className={loading ? "font-normal text-muted" : ""}>{loading ? t("analysis.aiLoading") : insight!.summary}</span>
    </p>
  );
}

export function InsightFactors({ url }: { url: string }) {
  const { t } = useI18n();
  const { loading, insight } = useInsight(url);
  if (loading) return <p className="text-[13px] text-muted">{t("analysis.factorsLoading")}</p>;
  if (!insight?.factors.length) return <p className="text-[13px] text-muted">{t("analysis.factorsUnavailable")}</p>;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-[18px] text-muted">
      {insight.factors.map((f) => (
        <li key={f}>{f}</li>
      ))}
    </ul>
  );
}
