import { InformationPage, informationMetadata } from "@/components/information/information-page";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { return informationMetadata("en", (await params).slug); }
export default async function Page({ params }: Props) { return <InformationPage locale="en" slug={(await params).slug} />; }
