import { DailyLog } from "../types";
import { getDailyLog } from "../services/storage";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

export function useDailyLog(date: string): {
    log: DailyLog | null;
    loading: boolean;
    refresh: () => Promise<void>;
}{
    const [log, setLog] = useState<DailyLog | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async() => {
        setLoading(true);
        const result = await getDailyLog(date);
        setLog(result);
        setLoading(false);
    }, [date]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    return {log, loading, refresh};
}
