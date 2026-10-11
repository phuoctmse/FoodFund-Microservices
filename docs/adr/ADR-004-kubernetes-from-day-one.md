# ADR-004 — Chạy Kubernetes từ ngày đầu: kind (local, CI), kubeadm một node (demo)

- **Trạng thái:** Đã chấp nhận — 2026-10-10; **sửa 2026-10-11**: đổi từ k3d/k3s sang kind/kubeadm (mục "Lịch sử").
- **Người quyết định:** chủ dự án
- **Liên quan:** `docs/rewrite/01-requirements.md` (mục 7.1, NFR-05, NFR-09, NFR-14), [ADR-001](./ADR-001-database-postgresql.md), [ADR-002](./ADR-002-edge-traefik.md), [ADR-003](./ADR-003-workflow-temporal.md)
- **Loại quyết định:** gần một chiều — manifest, Helm chart và cách vận hành ngấm vào toàn bộ dự án.
- **Thay thế:** "Docker Compose cho local và demo" trong `03-tech-stack.md` T-14; mục "Kubernetes ngoài phạm vi" trong requirements 7.1.

## Bối cảnh

- Chủ dự án muốn chạy Kubernetes ngay từ khi bắt đầu, cả ở máy phát triển, và **chỉ dùng một công cụ** để vừa làm FoodFund vừa luyện thi **CKA và CKAD**.
- CKA hiện thi trên **Kubernetes v1.35**, gồm Troubleshooting 30%, Kiến trúc/Cài đặt/Cấu hình cluster 25% (có "tạo và quản lý cluster bằng kubeadm"), Services & Networking 20%, Workloads & Scheduling 15%, Storage 10%; phiên bản thi được cập nhật 4–8 tuần sau mỗi bản Kubernetes mới ([Linux Foundation — CKA](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)).
- Temporal chỉ hỗ trợ chính thức việc tự host bằng Helm chart trên Kubernetes ([Temporal deployment](https://docs.temporal.io/self-hosted-guide/deployment)).

**Máy phát triển (đo 2026-10-10/11):** RAM 15,9 GB (2 khe × 8 GB, máy báo hỗ trợ tối đa 32 GB), Ryzen 7 5800H 8 nhân/16 luồng, RTX 3070 Laptop 8 GB VRAM, ổ C trống ~440 GB; Docker Desktop 29.4.1 (WSL2, VM nhận ~7,7 GB RAM).

**RAM ước tính khi chạy đủ stack trong cluster local** (ước lượng, đo ở spike S-4):

> **Đo thực tế 2026-10-11 (S-4):** hạ tầng đầy đủ (kind + Calico + Traefik + CloudNativePG/PG 18.6 + Temporal + Keycloak, chưa có service ứng dụng) dùng **~2,15 GB RAM thực** trong VM; dựng tuần tự lần đầu **~7,6 phút**. Bảng dưới là ước tính ban đầu, giữ để so sánh ([kết quả](../spikes/2026-10-11-s4-s7a-s9.md)).

| Thành phần | RAM |
|---|---|
| Node kind (kubeadm: etcd, kube-apiserver, controller-manager, scheduler, kubelet) + CNI | ~0,8–1,2 GB *(nặng hơn k3s ~0,5 GB; chưa đo)* |
| PostgreSQL (CloudNativePG, 1 instance) | 0,3–0,5 GB |
| Keycloak | 0,7–1,25 GB |
| Temporal + UI | ~0,7 GB |
| NATS + Traefik | ~0,15 GB |
| 6 service Go + AI worker | ~0,4–0,8 GB |
| `otel-lgtm` (tuỳ chọn) | ~1 GB |
| **Tổng** | **~4–6 GB** + overhead VM của Docker Desktop |

## Quyết định

| Môi trường | Kubernetes | Ghi chú |
|---|---|---|
| Local | **kind v0.33.0**, node image **cố định `kindest/node:v1.35.8`** (theo digest trong release notes) | kind dựng node **bằng kubeadm** → control plane là static pod trong `/etc/kubernetes/manifests`, giống môi trường thi CKA. Bản mặc định của kind v0.33.0 là v1.37 → **phải cố định** ([kind v0.33.0](https://github.com/kubernetes-sigs/kind/releases/tag/v0.33.0)) |
| CI | **kind**, cùng cấu hình với local | Job smoke trong GitHub Actions |
| Demo | **kubeadm một node** trên VPS (cùng minor version với local) | Local và demo **cùng là kubeadm**; tự dựng VPS (`kubeadm init`, CNI, nâng cấp) chính là bài luyện phần cài đặt của CKA |

**Thành phần hạ tầng trong cluster:**

| Thành phần | Cách cài | Tham chiếu |
|---|---|---|
| CNI | **Calico** v3.32.2 ở cả local (kind với `disableDefaultCNI: true`) và demo — cùng CNI hai môi trường, thực thi NetworkPolicy (có trong đề CKA/CKAD), tốn ~115 MiB. Dự phòng ở local: kindnet mặc định — **đã kiểm chứng 2026-10-11: kindnet trong kind v0.33.0 CÓ thực thi NetworkPolicy** (default-deny chặn đúng), trái với tài liệu minikube | — |
| Lưu trữ | kind có sẵn StorageClass `standard` (local-path); VPS kubeadm cài **local-path-provisioner** | ADR-001 (CloudNativePG cần StorageClass) |
| Lớp biên | Traefik (Gateway API), cài bằng Helm. Mở cổng: local dùng `extraPortMappings` 80/443 của node kind + Traefik `hostPort`; demo dùng Traefik `hostNetwork`/`hostPort` (VPS không có cloud load balancer) | ADR-002 |
| PostgreSQL 18 | Operator **CloudNativePG** (backup + PITR lên object storage) | ADR-001 |
| Temporal | Helm chart chính chủ, tắt dependency đóng gói sẵn | ADR-003 |
| Keycloak | Operator hoặc chart chính chủ (chọn ở S-4) | T-8 |
| NATS | Helm chart chính chủ, khi có consumer đầu tiên | T-4 |
| Chứng chỉ (demo) | cert-manager + Let's Encrypt | ADR-002 |
| Quan sát | `otel-lgtm` — tuỳ chọn, tắt mặc định ở local; demo dùng Grafana Cloud | T-13 |

**Về LoadBalancer:** tài liệu kind hiện giới thiệu **cloud-provider-kind** để cấp LoadBalancer (từ v0.9.0 hỗ trợ cả Ingress và Gateway API) ([kind — Ingress](https://kind.sigs.k8s.io/docs/user/ingress/)). FoodFund chọn `extraPortMappings` + `hostPort` vì tất định, giống cách mở cổng trên VPS kubeadm, và không thêm tiến trình chạy ngoài cluster. cloud-provider-kind là phương án thay thế nếu S-4 cho thấy cách trên bất tiện; khả năng truy cập IP LoadBalancer từ Windows qua Docker Desktop **chưa kiểm chứng**.

## Luật đi kèm

1. **Không dùng Helm chart/image của Bitnami.** Từ 28/08/2025 image chuyển sang `bitnamilegacy` và không còn cập nhật bảo mật ([GitLab](https://gitlab.com/gitlab-com/gl-infra/production-engineering/-/issues/27125), [Broadcom](https://vcf.broadcom.com/vsc/bitnamiAnnouncement.pdf)). Chỉ dùng chart/operator chính chủ.
2. **Cố định phiên bản** mọi chart, image và **node image của kind** (theo digest); không dùng `latest`. Local và demo cùng minor version Kubernetes.
3. **Một đường chạy duy nhất:** `make up` kiểm tra công cụ (Docker, kind, kubectl, helm), tạo cluster kind từ file cấu hình trong repo, cài hạ tầng, deploy service, seed dữ liệu. Không duy trì song song Compose.
4. **Mọi pod khai báo `requests`/`limits`.**
5. **Service sẵn sàng cho Kubernetes (NFR-14):** cấu hình qua biến môi trường, `/healthz` và `/readyz`, tắt êm khi nhận SIGTERM, log JSON ra stdout, không ghi trạng thái ra đĩa cục bộ.
6. **Không làm ở giai đoạn 1:** GitOps (ArgoCD/Flux), nhiều node cho stack app, service mesh, autoscaling. Deploy demo bằng `helm upgrade`.
7. **Vòng lặp code nhanh:** service đang phát triển chạy trực tiếp trên máy (`go run`) nối vào hạ tầng trong cluster qua port-forward; hoặc nạp image bằng `kind load docker-image` — chọn ở spike S-8.
8. **Phân bổ chạy model AI.** Laptop chỉ chạy stack app; test E2E và demo gọi model ở **HF Spaces ZeroGPU** (dự phòng Modal, rồi HF Endpoint); eval S-6 chạy model local trên RTX 3070 (không bật app); code hằng ngày và CI dùng chế độ `fake` với phản hồi thật đã ghi lại. Nâng RAM lên 32 GB là phương án nếu stack app vẫn quá chật.
9. **Cluster luyện thi tách khỏi cluster FoodFund.** Luyện CKA/CKAD trên cluster kind riêng (có thể nhiều node), **không chạy cùng lúc** với stack FoodFund vì RAM; xoá khi xong (`kind delete cluster --name …`).
10. **Bộ nhớ của WSL.** Đo S-4: sau khi kéo image, VM WSL giữ **5,5 GB cache file** không trả cho Windows (`vmmemWSL` 6,9 GB trong khi chỉ dùng thực 2,15 GB; Windows còn 0,45 GB) dù tài liệu Microsoft ghi `autoMemoryReclaim` mặc định là `dropCache`. Đề xuất `.wslconfig`: `[wsl2] memory=6GB` + `[experimental] autoMemoryReclaim=dropCache` (ghi rõ), áp dụng khi chủ dự án đồng ý (`wsl --shutdown`) rồi đo lại. Tạm thời: `wsl -d docker-desktop -u root -- sh -c "sync; echo 3 > /proc/sys/vm/drop_caches"` (đo được: trả lại ~2,9 GB).

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| k3d (local) + k3s (demo) — *quyết định cũ* | Nhẹ nhất, có sẵn LB, nhưng k3s gộp control plane vào một binary, không dùng kubeadm → không luyện được phần nặng điểm nhất của CKA; chủ dự án muốn một công cụ cho cả dự án và luyện thi |
| minikube | Nhiều addon nhất nhưng nặng nhất; GPU không hỗ trợ trên Windows desktop; không sát CKA bằng kind |
| Docker Desktop Kubernetes (chế độ kind) | Cần đăng nhập Docker, đổi sang containerd image store; khó cố định phiên bản hơn kind CLI |
| Talos | Hướng production, không dùng kubeadm |
| kubeadm trên VM ở local | Sát CKA nhất nhưng mỗi VM ~2 GB — không đủ RAM để chạy cùng stack; phần này được luyện trên VPS demo |
| k3s cho demo, kind cho local | Local và demo khác bản phân phối (khác cách mở cổng, lưu trữ, LB) → hai bộ cấu hình |
| Kubernetes managed (EKS/GKE/DOKS) cho demo | Vượt ngân sách NFR-09 |

## Hệ quả

- **Tích cực:** một công cụ cho FoodFund, CKAD và CKA; local và demo cùng là kubeadm, cùng CNI; đúng phiên bản thi (1.35); Temporal chạy đúng cách triển khai chính thức; PITR qua CloudNativePG.
- **Tiêu cực:**
  - **Nặng hơn k3d** (control plane đầy đủ) trên laptop vốn đã chật RAM → đo ở S-4; Calico thêm RAM so với kindnet.
  - **Mất các tiện ích sẵn có của k3s**: LB (thay bằng `extraPortMappings`/`hostPort`), lưu trữ local-path trên VPS (cài thêm).
  - **VPS demo nhiều việc vận hành hơn k3s**: tự cài container runtime, kubeadm, CNI, local-path-provisioner, tự nâng cấp — đổi lại là bài luyện CKA thật.
  - NFR-05: người lạ cần Docker + kind + kubectl + helm; kéo node image ~vài trăm MB → đo ở S-4.

## Spike liên quan

- **S-4:** đo thời gian `make up` và RAM thực tế (kind + Calico); kiểm tra NetworkPolicy default-deny trên kindnet và Calico.
- **S-7:** Traefik lọc IP và nhận IP thật qua `extraPortMappings`/`hostPort` (kind) và `hostNetwork`/`hostPort` (VPS kubeadm) — xem ADR-002.
- **S-8:** cách code nhanh với cluster local.
- **S-9:** Temporal trên PostgreSQL 18.

## Điều kiện để xem lại quyết định

- S-4 cho thấy không chạy đủ stack trên laptop 16 GB dù đã tắt phần tuỳ chọn và dùng kindnet → nâng RAM 32 GB, hoặc quay lại k3d cho local (vẫn giữ kind cho luyện thi).
- S-8 cho thấy mỗi vòng sửa–chạy vượt ~30 giây với mọi cách đã thử.

## Lịch sử

- **2026-10-10:** chọn k3d (local, CI) + k3s một node (demo) — nhẹ nhất, có sẵn LB.
- **2026-10-11:** đổi sang kind + kubeadm vì chủ dự án muốn một công cụ dùng cho cả dự án và luyện thi CKA/CKAD; k3d đã gỡ khỏi máy, kind v0.33.0 đã cài (checksum khớp bản phát hành).
