import { Redirect } from "expo-router";

// The five native tabs live under /today, /library, /progress, /rooms and /me; "/" opens 今天.
export default function Index() {
  return <Redirect href="/today" />;
}
