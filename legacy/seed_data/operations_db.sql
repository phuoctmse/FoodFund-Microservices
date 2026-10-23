--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.4

-- Started on 2025-12-11 10:17:33

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 32049)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO doadmin;

--
-- TOC entry 225 (class 1259 OID 32195)
-- Name: delivery_status_logs; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.delivery_status_logs (
    id text NOT NULL,
    delivery_task_id text NOT NULL,
    status public."Delivery_Task_Status" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    changed_by text NOT NULL,
    note text
);


ALTER TABLE public.delivery_status_logs OWNER TO doadmin;

--
-- TOC entry 224 (class 1259 OID 32185)
-- Name: delivery_tasks; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.delivery_tasks (
    id text NOT NULL,
    delivery_staff_id text NOT NULL,
    meal_batch_id text NOT NULL,
    status public."Delivery_Task_Status" DEFAULT 'PENDING'::public."Delivery_Task_Status" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.delivery_tasks OWNER TO doadmin;

--
-- TOC entry 220 (class 1259 OID 32148)
-- Name: expense_proofs; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.expense_proofs (
    id text NOT NULL,
    request_id text NOT NULL,
    media jsonb NOT NULL,
    amount bigint DEFAULT 0 NOT NULL,
    status public."Expense_Proof_Status" DEFAULT 'PENDING'::public."Expense_Proof_Status" NOT NULL,
    admin_note text,
    changed_status_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.expense_proofs OWNER TO doadmin;

--
-- TOC entry 226 (class 1259 OID 32203)
-- Name: inflow_transactions; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.inflow_transactions (
    id text NOT NULL,
    campaign_phase_id text NOT NULL,
    receiver_id text NOT NULL,
    transaction_type public."Inflow_Transaction_Type" NOT NULL,
    proof text,
    amount bigint DEFAULT 0 NOT NULL,
    status public."Inflow_Transaction_Status" DEFAULT 'PENDING'::public."Inflow_Transaction_Status" NOT NULL,
    is_reported boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    reported_at timestamp(3) without time zone,
    ingredient_request_id text,
    operation_request_id text
);


ALTER TABLE public.inflow_transactions OWNER TO doadmin;

--
-- TOC entry 219 (class 1259 OID 32139)
-- Name: ingredient_request_items; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.ingredient_request_items (
    id text NOT NULL,
    request_id text NOT NULL,
    ingredient_name character varying(100) NOT NULL,
    estimated_unit_price integer DEFAULT 0 NOT NULL,
    estimated_total_price integer DEFAULT 0 NOT NULL,
    supplier character varying(200),
    unit character varying(50) NOT NULL,
    planned_ingredient_id text,
    quantity numeric(10,2) NOT NULL
);


ALTER TABLE public.ingredient_request_items OWNER TO doadmin;

--
-- TOC entry 218 (class 1259 OID 32129)
-- Name: ingredient_requests; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.ingredient_requests (
    id text NOT NULL,
    campaign_phase_id text NOT NULL,
    kitchen_staff_id text NOT NULL,
    total_cost bigint DEFAULT 0 NOT NULL,
    status public."Ingredient_Request_Status" DEFAULT 'PENDING'::public."Ingredient_Request_Status" NOT NULL,
    changed_status_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    organization_id text
);


ALTER TABLE public.ingredient_requests OWNER TO doadmin;

--
-- TOC entry 223 (class 1259 OID 32178)
-- Name: meal_batch_ingredient_usages; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.meal_batch_ingredient_usages (
    id text NOT NULL,
    meal_batch_id text NOT NULL,
    ingredient_id text NOT NULL
);


ALTER TABLE public.meal_batch_ingredient_usages OWNER TO doadmin;

--
-- TOC entry 222 (class 1259 OID 32168)
-- Name: meal_batches; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.meal_batches (
    id text NOT NULL,
    campaign_phase_id text NOT NULL,
    kitchen_staff_id text NOT NULL,
    food_name character varying(100) NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    media jsonb,
    status public."Meal_Batch_Status" DEFAULT 'PREPARING'::public."Meal_Batch_Status" NOT NULL,
    cooked_date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    planned_meal_id text
);


ALTER TABLE public.meal_batches OWNER TO doadmin;

--
-- TOC entry 221 (class 1259 OID 32158)
-- Name: operation_requests; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.operation_requests (
    id text NOT NULL,
    campaign_phase_id text NOT NULL,
    user_id text NOT NULL,
    title character varying(100) NOT NULL,
    total_cost bigint DEFAULT 0 NOT NULL,
    expense_type public."Operation_Expense_Type" NOT NULL,
    status public."Operation_Request_Status" DEFAULT 'PENDING'::public."Operation_Request_Status" NOT NULL,
    admin_note text,
    changed_status_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    organization_id text
);


ALTER TABLE public.operation_requests OWNER TO doadmin;

--
-- TOC entry 4559 (class 0 OID 32049)
-- Dependencies: 217
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b3dd9783-5ffb-4e7a-a2db-be5136d5f7ba	dc1becb48bef861d130000694d918f67e00cc6879982605495424153574fbdca	2025-11-06 03:13:10.157869+00	20251106031309_init_operation_service_tables	\N	\N	2025-11-06 03:13:09.842065+00	1
a8014bc7-11d5-490b-92cd-a36bd899ae49	1831c9d89a18c526609c266bb3b45a3a987582949fa047e36610841255b51fc1	2025-11-10 12:27:11.635659+00	20251110122711_add_delivery_status_log_fields	\N	\N	2025-11-10 12:27:11.414728+00	1
4b3e9f64-7f8f-4355-8d93-46c9db0d64dd	8047c3b0b71614220c6085fad52629324ee40b02e11888435209a1ea6353b7b1	2025-11-14 07:01:50.680288+00	20251114070149_add_relationship_ingredient_and_operation	\N	\N	2025-11-14 07:01:50.08543+00	1
7336201e-9968-4e33-82da-9d4d48102ac2	a29ae4f5afe3fdec6a50853ea30aa1cb58a6cc7ae0851520c502f20c1091bae1	2025-11-15 03:01:30.583781+00	20251115030129_add_failed_reason_to_inflow_transaction	\N	\N	2025-11-15 03:01:30.256623+00	1
ab527cc5-5234-4194-89b8-6f1e02625e1c	122d743a0403e77ad7e0ed9447f5b8826f2fbdbc55612d936eff004dd13c2eec	2025-11-15 06:19:16.926703+00	20251115061844_remove_failed_reason_from_inflow_transaction	\N	\N	2025-11-15 06:19:16.588364+00	1
903a46c8-8667-4023-b739-20c85fea1100	796955975083ff3c78b64d965c4c3e8dfa4ad150431bf9a75d2848f24ad3beef	2025-11-15 06:19:26.712157+00	20251115061926_remove_failed_reason	\N	\N	2025-11-15 06:19:26.452535+00	1
c9e581b3-e3be-408f-8bb1-e13938d8c1f1	bb1a5548dd018abf9b17ebf8e724fb0b8597caa1895fa1b5e6449eee170a0efd	2025-11-25 02:13:42.361269+00	20251125021341_add_organization_id_to_requests	\N	\N	2025-11-25 02:13:42.164864+00	1
3078d44d-457e-460c-88fb-9f139245e7b3	c4b5f8508b4bc8d14c48fb4bfb0187774da71dab30b389cebf5134eaa4933453	2025-11-28 18:00:21.134782+00	20251128180019_adding_relationship_for_inflow_transaction	\N	\N	2025-11-28 18:00:20.506013+00	1
829bf58d-151b-45ec-a503-602ad1c261d7	a94d17cd03a0bc9b06c2c7afbfe69777f97981e0f466e446b41e17e3306eae65	2025-12-06 12:48:21.002788+00	20251206124656_update_ingredient_request_item_quantity_unit	\N	\N	2025-12-06 12:48:20.610068+00	1
da97f8ea-6ef8-4f9c-8add-20667d38602b	8b507b83a7c94fd476c06c5b8f4f7ade70f4eb180c3742d7ddd1282978b5348b	2025-12-07 07:56:50.01012+00	20251207075648_add_planned_meal_id_to_meal_batch	\N	\N	2025-12-07 07:56:49.514452+00	1
03566865-34e3-4f0f-9f56-535fa9ca1e59	92c9796eed9f5a4c919f2a3eed6a37918482f02c3055134fd6f2ce62ca0126c0	2025-12-08 07:36:41.156418+00	20251208073640_update_ingredient_request_item_quantity_to_decimal	\N	\N	2025-12-08 07:36:40.715216+00	1
\.


--
-- TOC entry 4567 (class 0 OID 32195)
-- Dependencies: 225
-- Data for Name: delivery_status_logs; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.delivery_status_logs (id, delivery_task_id, status, created_at, changed_by, note) FROM stdin;
dce0e3e3-4c5f-429a-b776-83bc2a1a1087	b80bbcba-a9b8-42b5-a857-3b7630081e72	PENDING	2025-11-11 14:40:08.913	19eaa51c-5061-7097-52d0-fa60f6db38e1	Task assigned by fundraiser to delivery staff a9cad55c-d051-701e-38c0-df1a299616e7
ff5b14f2-4534-4cd8-b395-4f240225f998	b80bbcba-a9b8-42b5-a857-3b7630081e72	ACCEPTED	2025-11-11 14:41:44.237	a9cad55c-d051-701e-38c0-df1a299616e7	\N
854fa105-e8a4-4635-b627-d8d35fc0e11d	b80bbcba-a9b8-42b5-a857-3b7630081e72	OUT_FOR_DELIVERY	2025-11-11 14:44:41.984	a9cad55c-d051-701e-38c0-df1a299616e7	\N
473bfd9e-8c4e-4a6f-b353-5896b5692b6a	06cc310c-7dbe-4158-aeb8-1990c9315153	PENDING	2025-11-12 04:49:55.703	19eaa51c-5061-7097-52d0-fa60f6db38e1	Task assigned by fundraiser to delivery staff a9cad55c-d051-701e-38c0-df1a299616e7
2edbfc7b-88af-4e07-95a9-f660904618d9	06cc310c-7dbe-4158-aeb8-1990c9315153	ACCEPTED	2025-11-12 04:50:49.48	a9cad55c-d051-701e-38c0-df1a299616e7	\N
0e97020a-0f33-465e-aa6f-247cbf7447e5	06cc310c-7dbe-4158-aeb8-1990c9315153	OUT_FOR_DELIVERY	2025-11-12 04:52:14.39	a9cad55c-d051-701e-38c0-df1a299616e7	\N
696c4817-8625-4ee3-86c0-924e978ea514	b2d4ef30-8392-46c2-965d-5724cf396e5a	PENDING	2025-12-03 17:57:16.01	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	Task assigned by fundraiser to delivery staff 598ae5fc-7011-70fd-ba2b-395140365cb0
808bfec6-f78e-48a8-bee8-4ad2ac4320f4	2c1441fd-a067-45c7-a01b-6e888bd2825f	PENDING	2025-12-04 02:42:08.941	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	Task assigned by fundraiser to delivery staff 598ae5fc-7011-70fd-ba2b-395140365cb0
18d2ac54-b2a4-4b8c-ab5c-f10164c7e5ed	8c0821dd-4768-4c86-8f96-1ab12366a65c	PENDING	2025-12-04 02:57:24.198	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	Task assigned by fundraiser to delivery staff 598ae5fc-7011-70fd-ba2b-395140365cb0
4678fa1e-83cb-494c-98f0-11fcf5c84836	2c1441fd-a067-45c7-a01b-6e888bd2825f	ACCEPTED	2025-12-04 03:05:18.723	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
10d0b0be-ef8d-44a0-8198-f28124c6cc10	b2d4ef30-8392-46c2-965d-5724cf396e5a	ACCEPTED	2025-12-04 03:09:40.691	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
d53aaf69-7836-4eb6-8daf-0c2fbc1c6c4f	8c0821dd-4768-4c86-8f96-1ab12366a65c	ACCEPTED	2025-12-04 03:42:03.135	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
202d78a1-7102-46aa-a9a5-ad96dfb104e9	b2d4ef30-8392-46c2-965d-5724cf396e5a	OUT_FOR_DELIVERY	2025-12-04 03:45:51.443	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
b36dddf6-0b4b-4893-87ad-f64723522cc5	b2d4ef30-8392-46c2-965d-5724cf396e5a	COMPLETED	2025-12-04 03:46:21.956	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
041d0818-6220-4322-bc5d-86885fa214c5	2c1441fd-a067-45c7-a01b-6e888bd2825f	OUT_FOR_DELIVERY	2025-12-04 03:49:38.422	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
e210e872-cab7-48cd-aa02-3b6409d82981	2c1441fd-a067-45c7-a01b-6e888bd2825f	COMPLETED	2025-12-04 03:50:04.892	598ae5fc-7011-70fd-ba2b-395140365cb0	\N
\.


--
-- TOC entry 4566 (class 0 OID 32185)
-- Dependencies: 224
-- Data for Name: delivery_tasks; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.delivery_tasks (id, delivery_staff_id, meal_batch_id, status, created_at, updated_at) FROM stdin;
b80bbcba-a9b8-42b5-a857-3b7630081e72	a9cad55c-d051-701e-38c0-df1a299616e7	8f7c80f5-1eb7-4659-9471-039da257c44f	OUT_FOR_DELIVERY	2025-11-11 14:40:08.776	2025-11-11 14:44:41.928
06cc310c-7dbe-4158-aeb8-1990c9315153	a9cad55c-d051-701e-38c0-df1a299616e7	0b9d38ca-15be-47af-bc13-8974d77c50ff	OUT_FOR_DELIVERY	2025-11-12 04:49:55.629	2025-11-12 04:52:14.352
8c0821dd-4768-4c86-8f96-1ab12366a65c	598ae5fc-7011-70fd-ba2b-395140365cb0	a0f11031-47c9-4b30-a9a2-52f6a5b5fc67	ACCEPTED	2025-12-04 02:57:24.193	2025-12-04 03:42:03.119
b2d4ef30-8392-46c2-965d-5724cf396e5a	598ae5fc-7011-70fd-ba2b-395140365cb0	a0f11031-47c9-4b30-a9a2-52f6a5b5fc67	COMPLETED	2025-12-03 17:57:15.707	2025-12-04 03:46:21.95
2c1441fd-a067-45c7-a01b-6e888bd2825f	598ae5fc-7011-70fd-ba2b-395140365cb0	a0f11031-47c9-4b30-a9a2-52f6a5b5fc67	COMPLETED	2025-12-04 02:42:08.933	2025-12-04 03:50:04.888
\.


--
-- TOC entry 4562 (class 0 OID 32148)
-- Dependencies: 220
-- Data for Name: expense_proofs; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.expense_proofs (id, request_id, media, amount, status, admin_note, changed_status_at, created_at, updated_at) FROM stdin;
8fb7cd6a-1a52-407e-8e87-998976abee4d	41208112-cb81-42f9-b250-e64f90fa36b0	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/expense-proofs/2025-11-11/ce401642-41208112-cb81-42f9-b250-e64f90fa36b0-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.jpeg", "https://foodfund.sgp1.cdn.digitaloceanspaces.com/expense-proofs/2025-11-11/364bdd65-41208112-cb81-42f9-b250-e64f90fa36b0-093ab54c-70f1-7008-1d8d-05adf6fc8748-2.mp4"]	9000000	APPROVED		2025-11-11 14:20:56.116	2025-11-11 14:17:01.063	2025-11-11 14:20:56.118
d258bd16-9d62-4133-9a74-12795d5e2b65	0e4b81b4-518c-4610-ab5c-3795907e7510	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/expense-proofs/2025-12-03/49112d7a-0e4b81b4-518c-4610-ab5c-3795907e7510-696a959c-c031-701c-085a-ff780e5b0f07-1.jpeg"]	100000	APPROVED	\N	2025-12-03 08:17:22.771	2025-12-03 07:42:34.578	2025-12-03 08:17:22.778
a08bea8b-26a7-46a6-8e9e-ac369310237c	0e4b81b4-518c-4610-ab5c-3795907e7510	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/expense-proofs/2025-12-03/ece4fab7-0e4b81b4-518c-4610-ab5c-3795907e7510-696a959c-c031-701c-085a-ff780e5b0f07-1.jpeg"]	100000	REJECTED	Bị lặp	2025-12-03 15:05:45.669	2025-12-03 07:37:37.99	2025-12-03 15:05:45.671
02024efc-12ab-4167-83ab-0aa1f1642762	11b6005f-42fe-4f95-8d58-bdf111f24ccf	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/expense-proofs/2025-12-05/f91acdea-11b6005f-42fe-4f95-8d58-bdf111f24ccf-a9ea353c-a0e1-70dc-c360-7e8efc3cf556-1.jpeg"]	80000	APPROVED	\N	2025-12-05 13:36:18.462	2025-12-05 13:16:55.71	2025-12-05 13:36:18.464
ec62822c-ab2f-4d38-9f64-16947132fe1a	c720cc2e-3617-49b2-b451-714a3b13a86e	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/expense-proofs/2025-12-07/2fb8a310-c720cc2e-3617-49b2-b451-714a3b13a86e-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.mp4"]	10000	PENDING		2025-12-07 09:15:58.387	2025-12-07 09:07:38.545	2025-12-07 09:15:58.391
\.


--
-- TOC entry 4568 (class 0 OID 32203)
-- Dependencies: 226
-- Data for Name: inflow_transactions; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.inflow_transactions (id, campaign_phase_id, receiver_id, transaction_type, proof, amount, status, is_reported, created_at, updated_at, reported_at, ingredient_request_id, operation_request_id) FROM stdin;
8a84c23b-701a-4c02-b241-357181649ed6	2ef201e5-7d14-4561-bcdb-916925ba4158	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	https://kenh14cdn.com/203336854389633024/2023/4/5/bill-gia-1680693402068526066261.jpg	13000	FAILED	f	2025-11-15 01:58:37.873	2025-11-15 03:03:36.072	\N	41208112-cb81-42f9-b250-e64f90fa36b0	\N
a9d4747a-da94-4188-a3a1-ce6d10943215	2ef201e5-7d14-4561-bcdb-916925ba4158	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	https://kenh14cdn.com/203336854389633024/2023/4/5/bill-gia-1680693402068526066261.jpg	13000	COMPLETED	t	2025-11-15 03:09:30.872	2025-11-15 03:12:12.402	2025-11-15 03:12:12.21	41208112-cb81-42f9-b250-e64f90fa36b0	\N
1af40446-b527-4730-bb7e-382fd4cfbb55	af8652f0-3ab6-4d6b-922a-a07720cc386f	d96ae52c-1031-70ec-91a7-8a77026ec88c	COOKING	disbursement-proofs/2025-11-23/98b16ac0-af8652f0-3ab6-4d6b-922a-a07720cc386f-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	1000	COMPLETED	t	2025-11-23 04:09:41.725	2025-11-23 04:10:13.902	2025-11-23 04:10:13.748	\N	30ec9b14-db3d-436b-acec-3c38181dceb0
3d87d003-abe3-4eaa-bcc8-afd50532d475	af8652f0-3ab6-4d6b-922a-a07720cc386f	d96ae52c-1031-70ec-91a7-8a77026ec88c	INGREDIENT	disbursement-proofs/2025-12-02/ec4eb8d2-af8652f0-3ab6-4d6b-922a-a07720cc386f-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	2000	COMPLETED	t	2025-12-02 09:21:05.469	2025-12-02 09:32:12.993	2025-12-02 09:32:12.756	0fd166a6-7a1d-4ba8-8f48-602d153c8c07	\N
395817ac-79fd-4747-8342-bc8758f25998	f32a9f41-d632-4eec-99ec-0165ee53f4d0	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	INGREDIENT	disbursement-proofs/2025-12-03/e80bd074-f32a9f41-d632-4eec-99ec-0165ee53f4d0-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	100000	COMPLETED	t	2025-12-03 15:43:49.393	2025-12-03 15:48:10.173	2025-12-03 15:48:09.976	0e4b81b4-518c-4610-ab5c-3795907e7510	\N
74872dfd-be68-446b-9439-32479111287c	af8652f0-3ab6-4d6b-922a-a07720cc386f	d96ae52c-1031-70ec-91a7-8a77026ec88c	COOKING	disbursement-proofs/2025-11-22/1f4a3fde-af8652f0-3ab6-4d6b-922a-a07720cc386f-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	1000	COMPLETED	t	2025-11-22 09:36:08.451	2025-11-22 09:49:16.22	2025-11-22 09:49:16.057	\N	\N
30a7e183-a883-42ac-ae87-d9090e653b8c	af8652f0-3ab6-4d6b-922a-a07720cc386f	d96ae52c-1031-70ec-91a7-8a77026ec88c	DELIVERY	2025-11-23/38688d08-af8652f0-3ab6-4d6b-922a-a07720cc386f-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	1000	FAILED	t	2025-11-23 03:32:57.994	2025-11-23 04:10:07.817	2025-11-23 04:10:07.817	\N	\N
b9dda102-0f93-4763-b3fc-efb03adfec7d	f32a9f41-d632-4eec-99ec-0165ee53f4d0	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	COOKING	disbursement-proofs/2025-12-04/14c5d562-f32a9f41-d632-4eec-99ec-0165ee53f4d0-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	10000	PENDING	t	2025-12-04 03:57:50.18	2025-12-04 04:00:06.052	2025-12-04 04:00:06.024	\N	\N
ed048c6d-a7c5-49bb-a878-2955f17b1f9c	f32a9f41-d632-4eec-99ec-0165ee53f4d0	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	DELIVERY	disbursement-proofs/2025-12-04/1b24438e-f32a9f41-d632-4eec-99ec-0165ee53f4d0-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	20000	PENDING	f	2025-12-04 04:23:29.079	2025-12-04 04:23:29.079	\N	\N	\N
3c0da7ae-ec83-4e8c-b537-69ce79fc0aac	f578ce15-211a-4951-a0b1-349984dd30bf	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	disbursement-proofs/2025-11-16/a6055eb5-f578ce15-211a-4951-a0b1-349984dd30bf-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	6500	FAILED	t	2025-11-16 11:17:11.422	2025-11-16 11:37:37.817	2025-11-16 11:37:37.817	\N	\N
223e17d2-ed29-4d99-9e4d-a5d983273952	898dccc9-41d2-4035-a354-6284eca947fb	59ca659c-60c1-70d7-23dd-3a26a0c5df58	COOKING	disbursement-proofs/2025-12-04/1f2b73eb-898dccc9-41d2-4035-a354-6284eca947fb-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	10000	COMPLETED	t	2025-12-04 06:41:55.621	2025-12-04 06:42:17.78	2025-12-04 06:42:17.763	\N	e0f14b94-c2ce-433d-bd02-5ebcfd8b6b5f
01edc97c-5bfc-40d3-9481-a8f0210d98b8	898dccc9-41d2-4035-a354-6284eca947fb	59ca659c-60c1-70d7-23dd-3a26a0c5df58	INGREDIENT	disbursement-proofs/2025-12-04/7e7d4b4a-898dccc9-41d2-4035-a354-6284eca947fb-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	86000	COMPLETED	t	2025-12-04 06:38:35.526	2025-12-04 06:42:21.55	2025-12-04 06:42:21.534	11b6005f-42fe-4f95-8d58-bdf111f24ccf	\N
d606605f-4b3f-4ade-8ac3-8c5f5a8758fd	f578ce15-211a-4951-a0b1-349984dd30bf	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	https://foodfund.sgp1.cdn.digitaloceanspaces.com/disbursement-proofs/2025-11-16/8ff70710-f578ce15-211a-4951-a0b1-349984dd30bf-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	6500	FAILED	t	2025-11-16 11:39:15.577	2025-12-04 14:08:03.37	2025-12-04 14:08:03.369	\N	\N
03d979a9-e739-4b73-973d-d77cfbc97f74	b6d946c7-00c7-4851-9582-329933a3d522	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	https://foodfund.sgp1.cdn.digitaloceanspaces.com/disbursement-proofs/2025-11-16/8ff70710-f578ce15-211a-4951-a0b1-349984dd30bf-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	16000	FAILED	t	2025-12-05 09:48:32.286	2025-12-07 08:27:29.367	2025-12-07 08:27:29.367	\N	\N
c49028a8-641f-4111-a54d-e6a44b11e4b9	860f554b-fbab-4c42-b831-3a34584e084e	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	disbursement-proofs/2025-12-09/aa93e12a-860f554b-fbab-4c42-b831-3a34584e084e-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	10000	COMPLETED	t	2025-12-09 06:09:18.863	2025-12-09 06:14:43.178	2025-12-09 06:14:42.84	c720cc2e-3617-49b2-b451-714a3b13a86e	\N
cae020c7-0cc7-406e-b95a-40146a2f43d9	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	19eaa51c-5061-7097-52d0-fa60f6db38e1	INGREDIENT	disbursement-proofs/2025-12-09/c747532e-9565de73-dc0c-4fbd-a5ea-d8cbe459bd66-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	12500	COMPLETED	t	2025-12-09 15:20:58.114	2025-12-09 15:21:19.373	2025-12-09 15:21:19.11	8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	\N
\.


--
-- TOC entry 4561 (class 0 OID 32139)
-- Dependencies: 219
-- Data for Name: ingredient_request_items; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.ingredient_request_items (id, request_id, ingredient_name, estimated_unit_price, estimated_total_price, supplier, unit, planned_ingredient_id, quantity) FROM stdin;
d7196629-a338-44ad-8f9e-f879d7e32829	11b6005f-42fe-4f95-8d58-bdf111f24ccf	Gao	50000	50000	Bach Hoa Xanh	kg	\N	1.00
6550e422-eb84-4292-aff1-ac38ffec2175	c720cc2e-3617-49b2-b451-714a3b13a86e	Tôm	6000	6000	Bách Hóa Xanh - Quận 1	kg	857ed670-88e1-440d-b225-4c23a25678f4	60.00
7068e9d8-2f27-4fd1-92bc-32d41726a3f4	c720cc2e-3617-49b2-b451-714a3b13a86e	Cua	2000	2000	Chợ đầu mối	kg	cac00ec6-e4cc-4ec4-8acd-57811f1352eb	40.00
3d2714e4-ac08-4587-b28f-28939378d439	c720cc2e-3617-49b2-b451-714a3b13a86e	Gà	2000	2000	Chợ đầu mối	kg	\N	40.00
1722e2e2-ae3f-435a-a42e-bb3cccc380bd	41208112-cb81-42f9-b250-e64f90fa36b0	Gạo tám thơm	250000	5000000	Bách Hóa Xanh - Quận 1	kg	\N	999.00
127c8fc0-4300-429b-b2e6-439110de4f0d	41208112-cb81-42f9-b250-e64f90fa36b0	Thịt gà	350000	3500000	Chợ đầu mối	kg	\N	100.00
13cfa978-28f6-45bd-bdc5-776f8d5abce5	0fd166a6-7a1d-4ba8-8f48-602d153c8c07	Gạo	200	2000	BHX	kg	\N	10.00
6f116690-e79d-4866-99c8-c7ff1be305a0	0e4b81b4-518c-4610-ab5c-3795907e7510	Gạo trắng	10000	30000	Bách Hóa Xanh - Quận 3	kg	\N	3.00
b480beed-48fd-4bf4-99dd-26805bf1cf75	0e4b81b4-518c-4610-ab5c-3795907e7510	Sườn heo	70000	70000	Bách Hóa Xanh - Quận 3	kg	\N	1.00
c148b5e3-eb8b-42b9-8be6-b8f81df80362	1488e0a7-6073-4fec-a792-3e051183d3c7	Gạo	1000	8000	BHX	kg	\N	8.00
724bd3bc-99c3-4190-9096-96bed2b181a7	1488e0a7-6073-4fec-a792-3e051183d3c7	Thịt	1000	8000	BHX	kg	\N	8.00
42c2b7b0-e4f4-48c0-ae70-5c705ff43daf	11b6005f-42fe-4f95-8d58-bdf111f24ccf	Rau	18000	36000	Bach Hoa Xanh	kg	\N	2.00
16ecee75-90d0-456b-bd7a-0b1d70e9ade0	8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	Cơm	500	5000	BHX	Kg	3a196f62-f4ab-4876-9e64-22e2cf7302f9	10.00
d4f6b19f-8345-4b52-b1c2-0a9bbfdce44e	8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	Bò	500	2500	BHX	Kg	a3efef34-70a3-4c82-b28c-d8ae4bcb3e55	5.00
900eab49-0882-4cc5-a56e-fedbcd41ea46	8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	Sữa	100	5000	BHX	Hộp	a945bf96-1f7d-4c12-b277-43ffde0c9668	50.00
\.


--
-- TOC entry 4560 (class 0 OID 32129)
-- Dependencies: 218
-- Data for Name: ingredient_requests; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.ingredient_requests (id, campaign_phase_id, kitchen_staff_id, total_cost, status, changed_status_at, created_at, updated_at, organization_id) FROM stdin;
c720cc2e-3617-49b2-b451-714a3b13a86e	860f554b-fbab-4c42-b831-3a34584e084e	19eaa51c-5061-7097-52d0-fa60f6db38e1	10000	DISBURSED	2025-12-09 06:09:18.979	2025-12-07 02:40:14.552	2025-12-09 06:09:18.98	eb590ab7-df52-4201-85c1-645dd9f626a4
8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	19eaa51c-5061-7097-52d0-fa60f6db38e1	12500	DISBURSED	2025-12-09 15:20:58.127	2025-12-09 15:20:15.345	2025-12-09 15:20:58.128	eb590ab7-df52-4201-85c1-645dd9f626a4
41208112-cb81-42f9-b250-e64f90fa36b0	2ef201e5-7d14-4561-bcdb-916925ba4158	093ab54c-70f1-7008-1d8d-05adf6fc8748	13000	DISBURSED	2025-11-15 03:12:12.247	2025-11-11 13:46:43.29	2025-11-15 03:12:12.248	eb590ab7-df52-4201-85c1-645dd9f626a4
0fd166a6-7a1d-4ba8-8f48-602d153c8c07	af8652f0-3ab6-4d6b-922a-a07720cc386f	d96ae52c-1031-70ec-91a7-8a77026ec88c	2000	DISBURSED	2025-12-02 09:32:12.855	2025-12-02 09:08:55.464	2025-12-02 09:32:12.856	1c017129-7db6-42f5-99d7-5d209dfc1087
0e4b81b4-518c-4610-ab5c-3795907e7510	f32a9f41-d632-4eec-99ec-0165ee53f4d0	696a959c-c031-701c-085a-ff780e5b0f07	100000	DISBURSED	2025-12-03 15:48:10.092	2025-12-02 17:20:56.676	2025-12-03 15:48:10.102	ecb3e803-18c2-48a8-b450-f665d62128b8
11b6005f-42fe-4f95-8d58-bdf111f24ccf	898dccc9-41d2-4035-a354-6284eca947fb	a9ea353c-a0e1-70dc-c360-7e8efc3cf556	86000	DISBURSED	2025-12-04 06:38:35.588	2025-12-04 06:37:35.68	2025-12-04 06:38:35.59	69d6e983-61aa-4eda-b1b8-fc72329e033a
1488e0a7-6073-4fec-a792-3e051183d3c7	b6d946c7-00c7-4851-9582-329933a3d522	19eaa51c-5061-7097-52d0-fa60f6db38e1	16000	REJECTED	2025-12-07 08:13:36.005	2025-12-05 13:33:53.024	2025-12-07 08:13:36.014	eb590ab7-df52-4201-85c1-645dd9f626a4
\.


--
-- TOC entry 4565 (class 0 OID 32178)
-- Dependencies: 223
-- Data for Name: meal_batch_ingredient_usages; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.meal_batch_ingredient_usages (id, meal_batch_id, ingredient_id) FROM stdin;
9a1c2e8b-fc08-4627-a8c1-26ebcaaccf32	0b9d38ca-15be-47af-bc13-8974d77c50ff	1722e2e2-ae3f-435a-a42e-bb3cccc380bd
7a63f58e-f5ba-46a9-a96f-1a520d5dbe99	0b9d38ca-15be-47af-bc13-8974d77c50ff	127c8fc0-4300-429b-b2e6-439110de4f0d
22f7976f-9377-4277-b8bc-65d16f781f46	a0f11031-47c9-4b30-a9a2-52f6a5b5fc67	6f116690-e79d-4866-99c8-c7ff1be305a0
992ed10a-0386-42e4-92c1-3bca13d9c6f1	a0f11031-47c9-4b30-a9a2-52f6a5b5fc67	b480beed-48fd-4bf4-99dd-26805bf1cf75
17de0fa6-f170-4dba-9cc3-5976e9a01490	83e5afca-21c7-43dd-8f4c-0180f41eb04e	6f116690-e79d-4866-99c8-c7ff1be305a0
d58e5e9b-f87f-4a21-9039-1cea656bdf9b	2fb9e473-01ea-4385-a7ac-090ebf7f84bd	42c2b7b0-e4f4-48c0-ae70-5c705ff43daf
efa22c42-4c2b-4626-96f0-d38eb4d545e7	2fb9e473-01ea-4385-a7ac-090ebf7f84bd	d7196629-a338-44ad-8f9e-f879d7e32829
3b73ba76-dd58-4c7c-a5b9-350e2077c892	11a4c21b-9088-4f2d-8185-076fbaa16435	6550e422-eb84-4292-aff1-ac38ffec2175
5da92e36-92d7-4bd4-a526-cab292a602c5	238b1a31-3638-4e0a-9d59-ea634d45268a	3d2714e4-ac08-4587-b28f-28939378d439
e757c297-98fc-4b50-a684-cede69dc277b	8ecce192-85ea-4251-a444-08a1ab850ef2	7068e9d8-2f27-4fd1-92bc-32d41726a3f4
\.


--
-- TOC entry 4564 (class 0 OID 32168)
-- Dependencies: 222
-- Data for Name: meal_batches; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.meal_batches (id, campaign_phase_id, kitchen_staff_id, food_name, quantity, media, status, cooked_date, created_at, updated_at, planned_meal_id) FROM stdin;
c7a97486-0825-44c8-b0d0-effb96b7365f	43a4984c-1ed9-46ea-b1f6-14a6f5db21cb	093ab54c-70f1-7008-1d8d-05adf6fc8748	Cơm gà từ thiện - phase 1	120	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-11-08/1647de23-5dab141a-4ffb-4cc1-80a0-26265fb2bdbb-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.jpeg", "https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-11-08/9fc0e625-5dab141a-4ffb-4cc1-80a0-26265fb2bdbb-093ab54c-70f1-7008-1d8d-05adf6fc8748-2.jpeg"]	READY	2025-11-08 10:04:24.892	2025-11-08 10:03:05.807	2025-11-08 10:04:24.895	\N
8f7c80f5-1eb7-4659-9471-039da257c44f	5dab141a-4ffb-4cc1-80a0-26265fb2bdbb	093ab54c-70f1-7008-1d8d-05adf6fc8748	Cơm gà từ thiện - phase 1	120	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-11-08/f61981b3-5dab141a-4ffb-4cc1-80a0-26265fb2bdbb-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.jpeg", "https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-11-08/0721499f-5dab141a-4ffb-4cc1-80a0-26265fb2bdbb-093ab54c-70f1-7008-1d8d-05adf6fc8748-2.jpeg"]	DELIVERED	2025-11-08 10:28:34.689	2025-11-08 10:28:08.099	2025-11-11 14:44:41.826	\N
0b9d38ca-15be-47af-bc13-8974d77c50ff	2ef201e5-7d14-4561-bcdb-916925ba4158	093ab54c-70f1-7008-1d8d-05adf6fc8748	Cơm gà từ thiện	100	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-11-11/3e009876-2ef201e5-7d14-4561-bcdb-916925ba4158-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.mp4"]	DELIVERED	2025-11-11 14:32:54.221	2025-11-11 14:29:57.029	2025-11-12 04:52:14.23	\N
a0f11031-47c9-4b30-a9a2-52f6a5b5fc67	f32a9f41-d632-4eec-99ec-0165ee53f4d0	696a959c-c031-701c-085a-ff780e5b0f07	Com suon cho cong nhan	10	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-12-03/18cc8b68-f32a9f41-d632-4eec-99ec-0165ee53f4d0-696a959c-c031-701c-085a-ff780e5b0f07-1.jpeg"]	DELIVERED	2025-12-03 12:52:20.313	2025-12-03 12:16:08.107	2025-12-04 03:49:37.507	\N
83e5afca-21c7-43dd-8f4c-0180f41eb04e	f32a9f41-d632-4eec-99ec-0165ee53f4d0	696a959c-c031-701c-085a-ff780e5b0f07	com ga	10	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-12-03/e1632256-f32a9f41-d632-4eec-99ec-0165ee53f4d0-696a959c-c031-701c-085a-ff780e5b0f07-1.jpeg"]	READY	2025-12-04 06:45:54.806	2025-12-03 14:53:42.472	2025-12-04 06:45:54.808	\N
2fb9e473-01ea-4385-a7ac-090ebf7f84bd	898dccc9-41d2-4035-a354-6284eca947fb	a9ea353c-a0e1-70dc-c360-7e8efc3cf556	Suat com sinh vien	10	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-12-05/749636d1-898dccc9-41d2-4035-a354-6284eca947fb-a9ea353c-a0e1-70dc-c360-7e8efc3cf556-1.jpeg"]	PREPARING	2025-12-05 13:39:02.679	2025-12-05 13:39:02.686	2025-12-05 13:39:02.686	\N
11a4c21b-9088-4f2d-8185-076fbaa16435	860f554b-fbab-4c42-b831-3a34584e084e	093ab54c-70f1-7008-1d8d-05adf6fc8748	Tôm hùm alaska	100	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-11-11/3e009876-2ef201e5-7d14-4561-bcdb-916925ba4158-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.mp4"]	PREPARING	2025-12-07 09:21:41.608	2025-12-07 09:21:41.61	2025-12-07 09:21:41.61	1b729900-a788-4832-af74-d47ae3182c4b
238b1a31-3638-4e0a-9d59-ea634d45268a	860f554b-fbab-4c42-b831-3a34584e084e	093ab54c-70f1-7008-1d8d-05adf6fc8748	Gà quay	5	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-12-07/fc863a41-860f554b-fbab-4c42-b831-3a34584e084e-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.mp4"]	PREPARING	2025-12-07 09:31:07.286	2025-12-07 09:31:07.289	2025-12-07 09:31:07.289	\N
8ecce192-85ea-4251-a444-08a1ab850ef2	860f554b-fbab-4c42-b831-3a34584e084e	093ab54c-70f1-7008-1d8d-05adf6fc8748	Cua alaska	25	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/meal-batches/2025-12-07/7ce8ca4d-860f554b-fbab-4c42-b831-3a34584e084e-093ab54c-70f1-7008-1d8d-05adf6fc8748-1.mp4"]	PREPARING	2025-12-07 10:13:33.233	2025-12-07 10:13:33.235	2025-12-07 10:13:33.235	449ddb33-892f-4f59-8f7e-a3c21c9e6a25
\.


--
-- TOC entry 4563 (class 0 OID 32158)
-- Dependencies: 221
-- Data for Name: operation_requests; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.operation_requests (id, campaign_phase_id, user_id, title, total_cost, expense_type, status, admin_note, changed_status_at, created_at, updated_at, organization_id) FROM stdin;
a75ee4ec-1660-463e-a8dc-db4d1a51d8e6	5dab141a-4ffb-4cc1-80a0-26265fb2bdbb	093ab54c-70f1-7008-1d8d-05adf6fc8748	Chi phí nhân công - Phase 1	5000000	COOKING	APPROVED		2025-11-09 16:55:08.72	2025-11-09 16:44:55.334	2025-11-09 16:55:08.724	eb590ab7-df52-4201-85c1-645dd9f626a4
30ec9b14-db3d-436b-acec-3c38181dceb0	af8652f0-3ab6-4d6b-922a-a07720cc386f	d96ae52c-1031-70ec-91a7-8a77026ec88c	Thêm chi phí nhân cồn	1000	COOKING	DISBURSED	\N	2025-11-23 04:10:13.8	2025-11-23 04:00:55.713	2025-11-23 04:10:13.801	1c017129-7db6-42f5-99d7-5d209dfc1087
7ae2577e-6e1f-4015-95e7-e138ece594d0	5a3cfd07-eeab-465f-80fa-1c1cb98dba8b	d96ae52c-1031-70ec-91a7-8a77026ec88c	Chi phí nấu ăn chùa láng	1000	COOKING	PENDING	\N	\N	2025-11-25 08:59:03.588	2025-11-25 08:59:03.588	1c017129-7db6-42f5-99d7-5d209dfc1087
e0f14b94-c2ce-433d-bd02-5ebcfd8b6b5f	898dccc9-41d2-4035-a354-6284eca947fb	a9ea353c-a0e1-70dc-c360-7e8efc3cf556	Chi phí nau an	10000	COOKING	DISBURSED	\N	2025-12-04 06:41:55.642	2025-12-04 06:41:21.823	2025-12-04 06:41:55.643	69d6e983-61aa-4eda-b1b8-fc72329e033a
b6fefd4a-d17b-4184-8e4d-7b70a92b71ad	860f554b-fbab-4c42-b831-3a34584e084e	19eaa51c-5061-7097-52d0-fa60f6db38e1	Chi phí nhân công	5000	COOKING	PENDING	\N	2025-12-08 04:21:37.76	2025-12-07 10:01:30.847	2025-12-08 04:21:37.761	eb590ab7-df52-4201-85c1-645dd9f626a4
80d98ef3-e284-49bd-a006-40db7e9e0193	f32a9f41-d632-4eec-99ec-0165ee53f4d0	696a959c-c031-701c-085a-ff780e5b0f07	Chi phí	20000	COOKING	PENDING	\N	\N	2025-12-10 17:40:01.75	2025-12-10 17:40:01.75	ecb3e803-18c2-48a8-b450-f665d62128b8
\.


--
-- TOC entry 4340 (class 2606 OID 32057)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4395 (class 2606 OID 32202)
-- Name: delivery_status_logs delivery_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.delivery_status_logs
    ADD CONSTRAINT delivery_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4388 (class 2606 OID 32194)
-- Name: delivery_tasks delivery_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.delivery_tasks
    ADD CONSTRAINT delivery_tasks_pkey PRIMARY KEY (id);


--
-- TOC entry 4357 (class 2606 OID 32157)
-- Name: expense_proofs expense_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.expense_proofs
    ADD CONSTRAINT expense_proofs_pkey PRIMARY KEY (id);


--
-- TOC entry 4402 (class 2606 OID 32213)
-- Name: inflow_transactions inflow_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.inflow_transactions
    ADD CONSTRAINT inflow_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4352 (class 2606 OID 32147)
-- Name: ingredient_request_items ingredient_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.ingredient_request_items
    ADD CONSTRAINT ingredient_request_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4348 (class 2606 OID 32138)
-- Name: ingredient_requests ingredient_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.ingredient_requests
    ADD CONSTRAINT ingredient_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4382 (class 2606 OID 32184)
-- Name: meal_batch_ingredient_usages meal_batch_ingredient_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.meal_batch_ingredient_usages
    ADD CONSTRAINT meal_batch_ingredient_usages_pkey PRIMARY KEY (id);


--
-- TOC entry 4376 (class 2606 OID 32177)
-- Name: meal_batches meal_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.meal_batches
    ADD CONSTRAINT meal_batches_pkey PRIMARY KEY (id);


--
-- TOC entry 4368 (class 2606 OID 32167)
-- Name: operation_requests operation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.operation_requests
    ADD CONSTRAINT operation_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4390 (class 1259 OID 44368)
-- Name: delivery_status_logs_changed_by_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_status_logs_changed_by_idx ON public.delivery_status_logs USING btree (changed_by);


--
-- TOC entry 4391 (class 1259 OID 32245)
-- Name: delivery_status_logs_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_status_logs_created_at_idx ON public.delivery_status_logs USING btree (created_at);


--
-- TOC entry 4392 (class 1259 OID 32246)
-- Name: delivery_status_logs_delivery_task_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_status_logs_delivery_task_id_created_at_idx ON public.delivery_status_logs USING btree (delivery_task_id, created_at);


--
-- TOC entry 4393 (class 1259 OID 32243)
-- Name: delivery_status_logs_delivery_task_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_status_logs_delivery_task_id_idx ON public.delivery_status_logs USING btree (delivery_task_id);


--
-- TOC entry 4396 (class 1259 OID 32244)
-- Name: delivery_status_logs_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_status_logs_status_idx ON public.delivery_status_logs USING btree (status);


--
-- TOC entry 4383 (class 1259 OID 32241)
-- Name: delivery_tasks_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_tasks_created_at_idx ON public.delivery_tasks USING btree (created_at);


--
-- TOC entry 4384 (class 1259 OID 32238)
-- Name: delivery_tasks_delivery_staff_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_tasks_delivery_staff_id_idx ON public.delivery_tasks USING btree (delivery_staff_id);


--
-- TOC entry 4385 (class 1259 OID 32242)
-- Name: delivery_tasks_delivery_staff_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_tasks_delivery_staff_id_status_idx ON public.delivery_tasks USING btree (delivery_staff_id, status);


--
-- TOC entry 4386 (class 1259 OID 32239)
-- Name: delivery_tasks_meal_batch_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_tasks_meal_batch_id_idx ON public.delivery_tasks USING btree (meal_batch_id);


--
-- TOC entry 4389 (class 1259 OID 32240)
-- Name: delivery_tasks_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX delivery_tasks_status_idx ON public.delivery_tasks USING btree (status);


--
-- TOC entry 4355 (class 1259 OID 32223)
-- Name: expense_proofs_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX expense_proofs_created_at_idx ON public.expense_proofs USING btree (created_at);


--
-- TOC entry 4358 (class 1259 OID 32221)
-- Name: expense_proofs_request_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX expense_proofs_request_id_idx ON public.expense_proofs USING btree (request_id);


--
-- TOC entry 4359 (class 1259 OID 32224)
-- Name: expense_proofs_request_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX expense_proofs_request_id_status_idx ON public.expense_proofs USING btree (request_id, status);


--
-- TOC entry 4360 (class 1259 OID 32222)
-- Name: expense_proofs_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX expense_proofs_status_idx ON public.expense_proofs USING btree (status);


--
-- TOC entry 4397 (class 1259 OID 32247)
-- Name: inflow_transactions_campaign_phase_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_campaign_phase_id_idx ON public.inflow_transactions USING btree (campaign_phase_id);


--
-- TOC entry 4398 (class 1259 OID 32253)
-- Name: inflow_transactions_campaign_phase_id_transaction_type_stat_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_campaign_phase_id_transaction_type_stat_idx ON public.inflow_transactions USING btree (campaign_phase_id, transaction_type, status);


--
-- TOC entry 4399 (class 1259 OID 32252)
-- Name: inflow_transactions_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_created_at_idx ON public.inflow_transactions USING btree (created_at);


--
-- TOC entry 4400 (class 1259 OID 32251)
-- Name: inflow_transactions_is_reported_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_is_reported_idx ON public.inflow_transactions USING btree (is_reported);


--
-- TOC entry 4403 (class 1259 OID 32248)
-- Name: inflow_transactions_receiver_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_receiver_id_idx ON public.inflow_transactions USING btree (receiver_id);


--
-- TOC entry 4404 (class 1259 OID 32250)
-- Name: inflow_transactions_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_status_idx ON public.inflow_transactions USING btree (status);


--
-- TOC entry 4405 (class 1259 OID 32249)
-- Name: inflow_transactions_transaction_type_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX inflow_transactions_transaction_type_idx ON public.inflow_transactions USING btree (transaction_type);


--
-- TOC entry 4350 (class 1259 OID 32220)
-- Name: ingredient_request_items_ingredient_name_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_request_items_ingredient_name_idx ON public.ingredient_request_items USING btree (ingredient_name);


--
-- TOC entry 4353 (class 1259 OID 85582)
-- Name: ingredient_request_items_planned_ingredient_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_request_items_planned_ingredient_id_idx ON public.ingredient_request_items USING btree (planned_ingredient_id);


--
-- TOC entry 4354 (class 1259 OID 32219)
-- Name: ingredient_request_items_request_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_request_items_request_id_idx ON public.ingredient_request_items USING btree (request_id);


--
-- TOC entry 4341 (class 1259 OID 32214)
-- Name: ingredient_requests_campaign_phase_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_campaign_phase_id_idx ON public.ingredient_requests USING btree (campaign_phase_id);


--
-- TOC entry 4342 (class 1259 OID 32218)
-- Name: ingredient_requests_campaign_phase_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_campaign_phase_id_status_idx ON public.ingredient_requests USING btree (campaign_phase_id, status);


--
-- TOC entry 4343 (class 1259 OID 32217)
-- Name: ingredient_requests_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_created_at_idx ON public.ingredient_requests USING btree (created_at);


--
-- TOC entry 4344 (class 1259 OID 32215)
-- Name: ingredient_requests_kitchen_staff_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_kitchen_staff_id_idx ON public.ingredient_requests USING btree (kitchen_staff_id);


--
-- TOC entry 4345 (class 1259 OID 69531)
-- Name: ingredient_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_organization_id_idx ON public.ingredient_requests USING btree (organization_id);


--
-- TOC entry 4346 (class 1259 OID 69532)
-- Name: ingredient_requests_organization_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_organization_id_status_idx ON public.ingredient_requests USING btree (organization_id, status);


--
-- TOC entry 4349 (class 1259 OID 32216)
-- Name: ingredient_requests_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX ingredient_requests_status_idx ON public.ingredient_requests USING btree (status);


--
-- TOC entry 4379 (class 1259 OID 32237)
-- Name: meal_batch_ingredient_usages_ingredient_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batch_ingredient_usages_ingredient_id_idx ON public.meal_batch_ingredient_usages USING btree (ingredient_id);


--
-- TOC entry 4380 (class 1259 OID 32236)
-- Name: meal_batch_ingredient_usages_meal_batch_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batch_ingredient_usages_meal_batch_id_idx ON public.meal_batch_ingredient_usages USING btree (meal_batch_id);


--
-- TOC entry 4371 (class 1259 OID 32231)
-- Name: meal_batches_campaign_phase_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batches_campaign_phase_id_idx ON public.meal_batches USING btree (campaign_phase_id);


--
-- TOC entry 4372 (class 1259 OID 32235)
-- Name: meal_batches_campaign_phase_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batches_campaign_phase_id_status_idx ON public.meal_batches USING btree (campaign_phase_id, status);


--
-- TOC entry 4373 (class 1259 OID 32234)
-- Name: meal_batches_cooked_date_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batches_cooked_date_idx ON public.meal_batches USING btree (cooked_date);


--
-- TOC entry 4374 (class 1259 OID 32232)
-- Name: meal_batches_kitchen_staff_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batches_kitchen_staff_id_idx ON public.meal_batches USING btree (kitchen_staff_id);


--
-- TOC entry 4377 (class 1259 OID 86321)
-- Name: meal_batches_planned_meal_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batches_planned_meal_id_idx ON public.meal_batches USING btree (planned_meal_id);


--
-- TOC entry 4378 (class 1259 OID 32233)
-- Name: meal_batches_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX meal_batches_status_idx ON public.meal_batches USING btree (status);


--
-- TOC entry 4361 (class 1259 OID 32230)
-- Name: operation_requests_campaign_phase_id_expense_type_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_campaign_phase_id_expense_type_status_idx ON public.operation_requests USING btree (campaign_phase_id, expense_type, status);


--
-- TOC entry 4362 (class 1259 OID 32225)
-- Name: operation_requests_campaign_phase_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_campaign_phase_id_idx ON public.operation_requests USING btree (campaign_phase_id);


--
-- TOC entry 4363 (class 1259 OID 32229)
-- Name: operation_requests_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_created_at_idx ON public.operation_requests USING btree (created_at);


--
-- TOC entry 4364 (class 1259 OID 32227)
-- Name: operation_requests_expense_type_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_expense_type_idx ON public.operation_requests USING btree (expense_type);


--
-- TOC entry 4365 (class 1259 OID 69533)
-- Name: operation_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_organization_id_idx ON public.operation_requests USING btree (organization_id);


--
-- TOC entry 4366 (class 1259 OID 69534)
-- Name: operation_requests_organization_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_organization_id_status_idx ON public.operation_requests USING btree (organization_id, status);


--
-- TOC entry 4369 (class 1259 OID 32228)
-- Name: operation_requests_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_status_idx ON public.operation_requests USING btree (status);


--
-- TOC entry 4370 (class 1259 OID 32226)
-- Name: operation_requests_user_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX operation_requests_user_id_idx ON public.operation_requests USING btree (user_id);


--
-- TOC entry 4411 (class 2606 OID 32279)
-- Name: delivery_status_logs delivery_status_logs_delivery_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.delivery_status_logs
    ADD CONSTRAINT delivery_status_logs_delivery_task_id_fkey FOREIGN KEY (delivery_task_id) REFERENCES public.delivery_tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4410 (class 2606 OID 32274)
-- Name: delivery_tasks delivery_tasks_meal_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.delivery_tasks
    ADD CONSTRAINT delivery_tasks_meal_batch_id_fkey FOREIGN KEY (meal_batch_id) REFERENCES public.meal_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4407 (class 2606 OID 32259)
-- Name: expense_proofs expense_proofs_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.expense_proofs
    ADD CONSTRAINT expense_proofs_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.ingredient_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4412 (class 2606 OID 81571)
-- Name: inflow_transactions inflow_transactions_ingredient_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.inflow_transactions
    ADD CONSTRAINT inflow_transactions_ingredient_request_id_fkey FOREIGN KEY (ingredient_request_id) REFERENCES public.ingredient_requests(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4413 (class 2606 OID 81576)
-- Name: inflow_transactions inflow_transactions_operation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.inflow_transactions
    ADD CONSTRAINT inflow_transactions_operation_request_id_fkey FOREIGN KEY (operation_request_id) REFERENCES public.operation_requests(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4406 (class 2606 OID 32254)
-- Name: ingredient_request_items ingredient_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.ingredient_request_items
    ADD CONSTRAINT ingredient_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.ingredient_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4408 (class 2606 OID 32269)
-- Name: meal_batch_ingredient_usages meal_batch_ingredient_usages_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.meal_batch_ingredient_usages
    ADD CONSTRAINT meal_batch_ingredient_usages_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredient_request_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4409 (class 2606 OID 32264)
-- Name: meal_batch_ingredient_usages meal_batch_ingredient_usages_meal_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.meal_batch_ingredient_usages
    ADD CONSTRAINT meal_batch_ingredient_usages_meal_batch_id_fkey FOREIGN KEY (meal_batch_id) REFERENCES public.meal_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;


-- Completed on 2025-12-11 10:17:38

--
-- PostgreSQL database dump complete
--

