import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { useFollow } from "@/hooks/useFollow";
import type { FollowerListResponse, FollowerOut } from "@/types/follow";

interface FollowersModalProps {
  userId: string;
  type: "followers" | "following";
  onClose: () => void;
}

export default function FollowersModal({ userId, type, onClose }: FollowersModalProps) {
  const { loadFollowers, loadFollowing } = useFollow(userId);
  const [data, setData] = useState<FollowerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadList = async () => {
      setLoading(true);
      const result = type === "followers" ? await loadFollowers(page) : await loadFollowing(page);
      setData(result);
      setLoading(false);
    };
    void loadList();
  }, [type, page, loadFollowers, loadFollowing, userId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: "#0f1521",
          border: "1px solid #1e2235",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "400px",
          maxHeight: "70vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "#e4e8f4",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #1e2235",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
            {type === "followers" ? "Followers" : "Following"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#7b86a6",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#7b86a6", padding: "24px" }}>
              Loading...
            </div>
          ) : !data || data.data.length === 0 ? (
            <div style={{ textAlign: "center", color: "#7b86a6", padding: "24px" }}>
              No {type} yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.data.map((item: FollowerOut) => (
                <div
                  key={item.id}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#161f35",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px" }}>
                      {item.display_name || item.username}
                    </div>
                    <div style={{ fontSize: "12px", color: "#8591b3" }}>
                      @{item.username}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {data && data.total > 0 && (
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid #1e2235",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#8591b3",
            }}
          >
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{ cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              Prev
            </button>
            <span>
              {page} / {Math.ceil(data.total / 20)}
            </span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(data.total / 20)}
              style={{ cursor: page >= Math.ceil(data.total / 20) ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
