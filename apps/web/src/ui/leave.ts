import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useNavigation } from "design-kit";

/** Ways out of a screen once its work is done. */
export function useLeave() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  return useMemo(() => ({
    /** Back to the screen beneath, or to `parent` when there is none. */
    back: (parent: string) => (navigation.back ? navigation.back(parent) : void navigate(parent, { replace: true })),
    /** Back to `path`, through whatever lies over it. */
    popTo: (path: string) => (navigation.popTo ? navigation.popTo(path) : void navigate(path, { replace: true })),
  }), [navigation, navigate]);
}
