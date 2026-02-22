from __future__ import annotations

import argparse
import os
import time
from pathlib import Path
from typing import List

from .demand_extractor import build_meta_summary, cluster_demands, extract_demand_candidates
from .social_client import SocialClient
from .reporting import (
    build_demandsolution_seed,
    serialize_candidates,
    serialize_clusters,
    serialize_posts,
    timestamped_output_dir,
    write_json,
    write_jsonl,
    write_markdown_report,
)

DEFAULT_SOURCES = "hackernews,stackoverflow"
DEFAULT_USER_AGENT = "demand-signal-collector/0.1 (contact: jacksuyu@gmail.com)"
DEFAULT_SEARCH_QUERIES = "need app,looking for tool,wish there was,how do i automate,any software for,struggling with"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect and summarize user demand from public social sources.")
    parser.add_argument("--sources", default=DEFAULT_SOURCES, help="Comma-separated sources: hackernews,stackoverflow")
    parser.add_argument("--per-query-per-source", type=int, default=40, help="Max posts/questions fetched per query per source.")
    parser.add_argument("--stackexchange-site", default="stackoverflow", help="StackExchange site (default: stackoverflow).")
    parser.add_argument("--hours", type=int, default=168, help="Only include posts newer than this many hours.")
    parser.add_argument("--min-score", type=int, default=2, help="Minimum demand confidence score.")
    parser.add_argument("--similarity-threshold", type=float, default=0.62, help="Fuzzy grouping threshold (0-1).")
    parser.add_argument("--output-dir", default="data/social_requirements", help="Base output directory.")
    parser.add_argument(
        "--user-agent",
        default=os.getenv("SOCIAL_USER_AGENT", os.getenv("REDDIT_USER_AGENT", DEFAULT_USER_AGENT)),
        help="HTTP User-Agent.",
    )
    parser.add_argument("--search-queries", default=DEFAULT_SEARCH_QUERIES, help="Comma-separated query terms for /search.json.")
    parser.add_argument(
        "--include-self-promo",
        action="store_true",
        help="Include self-promotional founder posts (default excludes them).",
    )
    return parser.parse_args()


def parse_csv_terms(raw: str) -> List[str]:
    return [s.strip() for s in raw.split(",") if s.strip()]


def main() -> None:
    args = parse_args()
    sources = {s.lower() for s in parse_csv_terms(args.sources)}
    if not sources:
        raise ValueError("At least one source is required.")
    if not {"hackernews", "stackoverflow"} & sources:
        raise ValueError("Supported sources are: hackernews, stackoverflow")

    client = SocialClient(user_agent=args.user_agent)
    search_queries = parse_csv_terms(args.search_queries)
    all_posts = []
    fetch_failures = []
    from_date = int(time.time()) - (args.hours * 3600)

    for query in search_queries:
        if "hackernews" in sources:
            try:
                hn_posts = client.fetch_hn_search(query=query, limit=args.per_query_per_source)
                all_posts.extend(hn_posts)
                print(f"HN query '{query}': {len(hn_posts):>3} posts")
            except Exception as exc:
                message = f"Failed HN query='{query}': {exc}"
                fetch_failures.append(message)
                print(f"[WARN] {message}")

        if "stackoverflow" in sources:
            try:
                se_posts = client.fetch_stackexchange_search(
                    query=query,
                    site=args.stackexchange_site,
                    limit=args.per_query_per_source,
                    from_date_utc=from_date,
                )
                all_posts.extend(se_posts)
                print(f"SE({args.stackexchange_site}) query '{query}': {len(se_posts):>3} posts")
            except Exception as exc:
                message = f"Failed StackExchange query='{query}': {exc}"
                fetch_failures.append(message)
                print(f"[WARN] {message}")

    if not all_posts:
        raise RuntimeError(
            "No social posts were fetched from Hacker News/StackExchange. "
            "Check network access and try reducing --per-query-per-source."
        )

    # Deduplicate by source + post ID
    dedup = {}
    for post in all_posts:
        dedup[f"{post.subreddit}:{post.id}"] = post
    posts = list(dedup.values())

    candidates = extract_demand_candidates(
        posts=posts,
        max_age_hours=args.hours,
        min_score=args.min_score,
        exclude_self_promo=not args.include_self_promo,
    )
    clusters = cluster_demands(candidates=candidates, threshold=args.similarity_threshold)
    meta = build_meta_summary(posts=posts, candidates=candidates, clusters=clusters)

    out_dir = timestamped_output_dir(Path(args.output_dir))
    write_jsonl(out_dir / "raw_posts.jsonl", serialize_posts(posts))
    write_jsonl(out_dir / "demand_candidates.jsonl", serialize_candidates(candidates))
    write_json(
        out_dir / "demand_clusters.json",
        {
            "meta": meta,
            "clusters": serialize_clusters(clusters),
        },
    )
    write_json(out_dir / "demandsolution_seed_ideas.json", build_demandsolution_seed(clusters, source_name="social"))
    write_markdown_report(out_dir / "report.md", meta=meta, clusters=clusters)

    print("")
    print(f"Saved outputs to: {out_dir}")
    print(f"Total posts: {meta['total_posts']}")
    print(f"Demand candidates: {meta['total_candidates']}")
    print(f"Demand clusters: {meta['total_clusters']}")
    if fetch_failures:
        print(f"Warnings: {len(fetch_failures)} fetch calls failed but pipeline continued.")


if __name__ == "__main__":
    main()
