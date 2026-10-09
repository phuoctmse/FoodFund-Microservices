# ADR-004 — Chạy Kubernetes từ ngày đầu: k3d (local), k3s một node (demo)

- **Trạng thái:** Đã chấp nhận — 2026-10-10
- **Người quyết định:** chủ dự án
- **Liên quan:** `docs/rewrite/01-requirements.md` (mục 7.1, NFR-05, NFR-09, NFR-14), [ADR-001](./ADR-001-database-postgresql.md), [ADR-002](./ADR-002-edge-traefik.md), [ADR-003](./ADR-003-workflow-temporal.md)
- **Loại quyết định:** gần một chiều — manifest, Helm chart và cách vận hành ngấm vào toàn bộ dự án.
- **Thay thế:** "Docker Compose cho local và demo" trong `03-tech-stack.md` T-14; mục "Kubernetes ngoài phạm vi" trong requirements 7.1.

## Bối cảnh

- Chủ dự án muốn chạy Kubernetes ngay từ khi bắt đầu, cả ở máy phát triển.
- **Giả định về mục tiêu** (chủ dự án chưa nêu rõ): vừa để môi trường local giống môi trường deploy, vừa để thể hiện kỹ năng Kubernetes trong portfolio. Vì vậy phần Kubernetes được giữ ở mức **"đủ dùng"**, không đầu tư sớm vào GitOps, nhiều node hay service mesh.
- Temporal chỉ hỗ trợ chính thức việc tự host bằng Helm chart trên Kubernetes ([Temporal deployment](https://docs.temporal.io/self-hosted-guide/deployment)) → chạy Compose cho Temporal là phương án tạm (ADR-003).

**Máy phát triển (đo ngày 2026-10-10):** RAM 15,9 GB (lúc đo còn trống 4,7 GB), Ryzen 7 5800H 8 nhân/16 luồng, ổ C trống 428 GB; đã có Docker Desktop (WSL2), kubectl, helm, kind, minikube.

**RAM ước tính khi chạy đủ stack trong cluster local** (ước lượng, đo lại ở spike S-4):

| Thành phần | RAM |
|---|---|
| k3s trong k3d | ~0,5 GB |
| PostgreSQL (CloudNativePG, 1 instance) | 0,3–0,5 GB |
| Keycloak | 0,7–1,25 GB |
| Temporal + UI | ~0,7 GB |
| NATS + Traefik | ~0,15 GB |
| 6 service Go + AI | ~0,4–0,8 GB |
| Grafana LGTM (tuỳ chọn) | ~1 GB |
| **Tổng** | **~3,7–5,7 GB** + overhead VM của Docker Desktop |

## Quyết định

| Môi trường | Kubernetes | Ghi chú |
|---|---|---|
| Local | **k3d** (k3s chạy trong Docker) | Nhẹ nhất trong k3d/kind/minikube, có sẵn load balancer ([so sánh 2026](https://devopsboys.com/blog/kind-vs-k3d-vs-minikube-local-kubernetes-2026)) |
| CI | **k3d** | Cùng bản phân phối với local, dùng cho job smoke |
| Demo | **k3s một node** trên VPS | Cùng họ với k3d → cùng manifest, cùng Helm values |

**Thành phần hạ tầng trong cluster:**

| Thành phần | Cách cài | Tham chiếu |
|---|---|---|
| Lớp biên | Traefik (Gateway API) | ADR-002 |
| PostgreSQL 18 | Operator **CloudNativePG** (backup + PITR lên object storage) | ADR-001 |
| Temporal | Helm chart chính chủ, tắt dependency đóng gói sẵn | ADR-003 |
| Keycloak | Operator hoặc chart chính chủ (chọn trong spike S-4) | T-8 |
| NATS | Helm chart chính chủ | T-4 |
| Chứng chỉ (demo) | cert-manager + Let's Encrypt | ADR-002 |
| Quan sát | Grafana LGTM — **tuỳ chọn**, tắt mặc định ở local | T-13 |

## Luật đi kèm

1. **Không dùng Helm chart/image của Bitnami.** Từ 28/08/2025 image chuyển sang `bitnamilegacy` và không còn cập nhật bảo mật; bản miễn phí chỉ còn tag `latest` ([GitLab](https://gitlab.com/gitlab-com/gl-infra/production-engineering/-/issues/27125), [Broadcom](https://vcf.broadcom.com/vsc/bitnamiAnnouncement.pdf)). Chỉ dùng chart/operator chính chủ.
2. **Cố định phiên bản** mọi chart và image; không dùng `latest`.
3. **Một đường chạy duy nhất:** `make up` kiểm tra công cụ cần có, tạo cluster k3d, cài hạ tầng, deploy service, seed dữ liệu. Không duy trì song song Compose.
4. **Mọi pod khai báo `requests`/`limits`**; WSL được giới hạn RAM (~8 GB) để không làm treo máy.
5. **Service sẵn sàng cho Kubernetes (NFR-14):** cấu hình qua biến môi trường, `/healthz` và `/readyz`, tắt êm khi nhận SIGTERM, log JSON ra stdout, không ghi trạng thái ra đĩa cục bộ.
6. **Không làm ở giai đoạn 1:** GitOps (ArgoCD/Flux), nhiều node, service mesh, autoscaling. CI deploy bằng `helm upgrade`.
7. **Vòng lặp code nhanh:** service đang phát triển chạy trực tiếp trên máy (`go run`) nối vào hạ tầng trong cluster qua port-forward; hoặc công cụ đồng bộ code vào pod — chọn ở spike S-8 (tình trạng bảo trì của Tilt chưa kiểm chứng).

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Compose cho local, k3s cho demo | Hai đường chạy, hai bộ cấu hình phải giữ đồng bộ → nợ |
| kind | Gần upstream, tốt cho CI, nhưng không có load balancer sẵn và là bản phân phối khác với k3s trên VPS |
| minikube | Nặng nhất; nhiều node còn hạn chế |
| Kubernetes managed (EKS/GKE/DOKS) cho demo | Vượt ngân sách NFR-09 |

## Hệ quả

- **Tích cực:** local giống demo; Temporal chạy đúng cách triển khai chính thức; PITR có sẵn qua CloudNativePG; thể hiện kỹ năng Kubernetes.
- **Tiêu cực:**
  - RAM laptop sát giới hạn → LGTM tuỳ chọn, đóng bớt ứng dụng khi chạy đủ stack.
  - Vòng lặp code chậm hơn nếu không có cách chạy service ngoài cluster (S-8).
  - NFR-05 khó hơn: người lạ cần Docker + k3d + kubectl + helm; thời gian kéo image lớn hơn → đo ở S-4.
  - Đường cong học: Kubernetes, Helm, operator.

## Spike liên quan

- **S-4:** đo thời gian `make up` từ máy sạch và RAM thực tế trên laptop này.
- **S-8:** cách code nhanh với cluster local.
- **S-9:** Temporal trên PostgreSQL 18 (công cụ quản lý schema — ADR-003).

## Điều kiện để xem lại quyết định

- S-4 cho thấy không chạy đủ stack được trên laptop 16 GB dù đã tắt phần tuỳ chọn → cân nhắc chạy hạ tầng nặng (Keycloak, Temporal) trên VPS dev dùng chung.
- S-8 cho thấy mỗi vòng sửa–chạy vượt ~30 giây với mọi cách đã thử.
