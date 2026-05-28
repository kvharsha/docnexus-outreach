import { redirect } from "next/navigation";

// There's no real landing page — physician discovery is the entry point of the workflow.
export default function Home() {
  redirect("/physicians");
}
