import type { Metadata } from "next";
import { AccountSettings } from "@/components/AccountSettings";

export const metadata: Metadata = {
  title: "Account settings",
  description: "Manage your Procharacters account, email, passphrase, and saved chats.",
};

export default function AccountPage() {
  return <AccountSettings />;
}
