import { useDispatch, useSelector } from "react-redux";

/**
 * Typed wrappers — using named re-exports keeps the import path consistent
 * across the codebase so switching to TypeScript later requires only this file.
 */
export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
