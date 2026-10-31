// Loading UI only for list pages. Detail pages have none, so notFound() can still send a real 404 status
// (once a Suspense boundary starts streaming, the status code is already 200).
export { RouteLoading as default } from "@/components/route-loading";
