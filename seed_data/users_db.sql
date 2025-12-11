--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.4

-- Started on 2025-12-11 10:17:05

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

--
-- TOC entry 6 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4585 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 896 (class 1247 OID 16498)
-- Name: Availability_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Availability_Status" AS ENUM (
    'AVAILABLE',
    'UNAVAILABLE'
);


ALTER TYPE public."Availability_Status" OWNER TO doadmin;

--
-- TOC entry 890 (class 1247 OID 16479)
-- Name: Role; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Role" AS ENUM (
    'DONOR',
    'FUNDRAISER',
    'KITCHEN_STAFF',
    'DELIVERY_STAFF',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO doadmin;

--
-- TOC entry 923 (class 1247 OID 69053)
-- Name: Transaction_Type; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Transaction_Type" AS ENUM (
    'INCOMING_TRANSFER',
    'WITHDRAWAL',
    'ADMIN_ADJUSTMENT'
);


ALTER TYPE public."Transaction_Type" OWNER TO doadmin;

--
-- TOC entry 893 (class 1247 OID 16490)
-- Name: Verification_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Verification_Status" AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED',
    'INACTIVE',
    'CANCELLED'
);


ALTER TYPE public."Verification_Status" OWNER TO doadmin;

--
-- TOC entry 920 (class 1247 OID 33565)
-- Name: Wallet_Type; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Wallet_Type" AS ENUM (
    'FUNDRAISER',
    'ADMIN'
);


ALTER TYPE public."Wallet_Type" OWNER TO doadmin;

--
-- TOC entry 244 (class 1255 OID 75320)
-- Name: awsdms_intercept_ddl(); Type: FUNCTION; Schema: public; Owner: doadmin
--

CREATE FUNCTION public.awsdms_intercept_ddl() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
  declare _qry text;
BEGIN
  if (tg_tag='CREATE TABLE' or tg_tag='ALTER TABLE' or tg_tag='DROP TABLE' or tg_tag = 'CREATE TABLE AS') then
	    SELECT current_query() into _qry;
	    insert into public.awsdms_ddl_audit
	    values
	    (
	    default,current_timestamp,current_user,cast(TXID_CURRENT()as varchar(16)),tg_tag,0,'',current_schema,_qry
	    );
	    delete from public.awsdms_ddl_audit;
 end if;
END;
$$;


ALTER FUNCTION public.awsdms_intercept_ddl() OWNER TO doadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 16469)
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
-- TOC entry 223 (class 1259 OID 18076)
-- Name: badges; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.badges (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon_url text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.badges OWNER TO doadmin;

--
-- TOC entry 226 (class 1259 OID 18857)
-- Name: organization_members; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.organization_members (
    id text NOT NULL,
    organization_id text NOT NULL,
    member_id text NOT NULL,
    status public."Verification_Status" DEFAULT 'PENDING'::public."Verification_Status" NOT NULL,
    member_role public."Role" NOT NULL,
    joined_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    left_at timestamp(3) without time zone
);


ALTER TABLE public.organization_members OWNER TO doadmin;

--
-- TOC entry 225 (class 1259 OID 18848)
-- Name: organizations; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    activity_field text NOT NULL,
    address text NOT NULL,
    website text NOT NULL,
    description text NOT NULL,
    representative_id text NOT NULL,
    representative_name text NOT NULL,
    representative_identity_number text NOT NULL,
    email character varying(100) NOT NULL,
    phone_number character varying(20) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    status public."Verification_Status" DEFAULT 'PENDING'::public."Verification_Status" NOT NULL,
    bank_account_name character varying(255),
    bank_account_number character varying(255),
    bank_name character varying(50),
    bank_short_name character varying(50),
    reason text
);


ALTER TABLE public.organizations OWNER TO doadmin;

--
-- TOC entry 232 (class 1259 OID 87139)
-- Name: system_configs; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.system_configs (
    key character varying(100) NOT NULL,
    value character varying(500) NOT NULL,
    description text,
    data_type character varying(20) DEFAULT 'STRING'::character varying NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.system_configs OWNER TO doadmin;

--
-- TOC entry 224 (class 1259 OID 18086)
-- Name: user_badges; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.user_badges (
    id text NOT NULL,
    user_id text NOT NULL,
    badge_id text NOT NULL,
    awarded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_badges OWNER TO doadmin;

--
-- TOC entry 222 (class 1259 OID 16503)
-- Name: users; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.users (
    id text NOT NULL,
    full_name text NOT NULL,
    avatar_url character varying(255),
    email character varying(100) NOT NULL,
    phone_number character varying(20),
    role public."Role" DEFAULT 'DONOR'::public."Role" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    user_name character varying(50) NOT NULL,
    bio text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    cognito_id character varying(255),
    address text,
    donation_count integer DEFAULT 0,
    last_donation_at timestamp(3) without time zone,
    total_donated bigint DEFAULT 0
);


ALTER TABLE public.users OWNER TO doadmin;

--
-- TOC entry 228 (class 1259 OID 31600)
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.wallet_transactions (
    id text NOT NULL,
    wallet_id text NOT NULL,
    campaign_id text,
    amount bigint NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payment_transaction_id text,
    transaction_type public."Transaction_Type" NOT NULL,
    description text,
    gateway character varying(50),
    sepay_metadata jsonb,
    balance_after bigint,
    balance_before bigint
);


ALTER TABLE public.wallet_transactions OWNER TO doadmin;

--
-- TOC entry 227 (class 1259 OID 31591)
-- Name: wallets; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.wallets (
    id text NOT NULL,
    user_id text NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    wallet_type public."Wallet_Type" DEFAULT 'FUNDRAISER'::public."Wallet_Type" NOT NULL
);


ALTER TABLE public.wallets OWNER TO doadmin;

--
-- TOC entry 4571 (class 0 OID 16469)
-- Dependencies: 221
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
d5619d04-706f-41f4-8020-245ef048742a	40640cdcf7f0a1995a76db6f56843b703f7c8f1c87c4a689be76d5eb85b88e98	2025-09-13 17:27:57.112287+00	20250913172756_init_user_migration	\N	\N	2025-09-13 17:27:56.915488+00	1
01eda010-24c1-490f-8816-14ed6a5328b0	48f6ffdcf5212ae7508d199aada93c2dbecef8309cebb0c91144adaef382d5dd	2025-11-10 11:34:51.143868+00	20251110113450_add_field_reason_and_add_enum_verifcation_status	\N	\N	2025-11-10 11:34:50.813227+00	1
f94241c4-6cab-4c40-b7f2-383cdfa68586	3ada7364e942b5d875bcd7d6e79a05b89af384dcca7ade4557b24d7c8abc40b4	2025-09-22 02:37:38.508986+00	20250922023738_add_cognito_id	\N	\N	2025-09-22 02:37:38.347264+00	1
48c2a4b1-86ae-4210-9fc8-fad3085718da	61fc0f38a593cb99a6c6e6019cd24c1fb626e27050b799d23b03c26d72f384a0	2025-10-09 09:48:39.909523+00	20251009094839_	\N	\N	2025-10-09 09:48:39.755377+00	1
b9222fd8-4c43-4b1d-8c12-160d15d80c1b	cd055b142c406f0fe7111533b6c3dc7b4a71262a2ba7190297d69817a6d64752	2025-09-22 04:42:17.832771+00	20250922044217_remove_unique_phonenum	\N	\N	2025-09-22 04:42:17.677126+00	1
fcfcbeda-0832-46bd-bd1f-1f74a434c28e	2a25612e47c3271e70af3c53f682f9f85705fb322f27caeea5665265c2f3e467	2025-09-23 06:44:57.150943+00	20250923064456_field_phone_num	\N	\N	2025-09-23 06:44:56.994632+00	1
77746a24-3eb4-476d-98de-c7bc765adb2d	e7cefa8b9007e32bb0b76cfd1b20c5050a93a718cd7bc616e52555744aefa405	2025-09-23 07:42:36.140944+00	20250923074235_remove_organization_name	\N	\N	2025-09-23 07:42:35.985676+00	1
bfa998e9-d3fa-4a0d-adbe-ea7bf3bfd5bc	65f650b5e6022ff4d085a56b99d47751be757200eff79e1e4e79c23e6a9e4966	2025-10-10 10:28:06.490778+00	20251010102806_delete_donor_staff_table	\N	\N	2025-10-10 10:28:06.322653+00	1
40cef9a3-c502-4696-a335-945cc287fe93	f191266956ef55cb957f9478e99da2854c82a98b62a11ef505f71534ac1deca4	2025-09-26 10:21:21.189649+00	20250926102120_add_badge_model	\N	\N	2025-09-26 10:21:21.021239+00	1
e4fa7272-f3a6-4f54-b59b-4a10935bf5da	abc5f1c84689234a6b9243f78cfffa36e7142f746f4c584afe3f0ebf29e70e81	2025-09-26 10:27:37.075283+00	20250926102736_update_option_avatar_url	\N	\N	2025-09-26 10:27:36.913454+00	1
ab86340c-8ccb-46b8-add7-ed6346d8d89e	ba44343b3d3309148b0e908c2837bb67defc484b3186f6c46ec9c98db5674614	2025-10-07 07:53:31.754485+00	20251007075331_update_organization	\N	\N	2025-10-07 07:53:31.482201+00	1
1ebbcb80-b94d-4951-8bff-1af79e914e8b	c5894a2539550e6fd0f221f81b7d4c4b0d7b49396a1935a82f2facc05c1efbed	2025-10-13 17:20:07.681028+00	20251013172006_expand_range_field_user_name	\N	\N	2025-10-13 17:20:07.037493+00	1
4eec6dde-1595-47bf-8052-54162774c951	a9f140a94c0d598887d7a590ace85f88eb85e25e006c8ff1f7d006979cacaf96	2025-10-07 08:19:02.174665+00	20251007081901_update_relationship_staff_orga	\N	\N	2025-10-07 08:19:01.831976+00	1
65551742-7c40-4308-8873-6c95bb8a3d01	a0ffa1fb18e586f3c5b230cfbb6b00e4d5c1dace96b30fbb0ab33a79d03de329	2025-10-07 08:52:26.133201+00	20251007085225_update_status	\N	\N	2025-10-07 08:52:25.791697+00	1
b479bc71-a49c-4983-985e-c0fcddaf5daf	a0343721fedd86c27137f6c73b40430ebbd0b8b8f6e284bc1fb1eebc247a2649	2025-11-14 08:07:44.688459+00	20251114080743_add_balance_before_and_after	\N	\N	2025-11-14 08:07:44.197055+00	1
dd144448-8aeb-45f4-af4d-0ab7f4af7fc5	42fdfeda9c73b7f8d0814f955486f97d77533507e6cfa194cd5ed8a4139b9bdb	2025-10-08 12:04:06.376374+00	20251008120405_remove_unique_email_organization	\N	\N	2025-10-08 12:04:05.977823+00	1
42a80199-0646-448f-a21f-b120710e24ab	9a037c4c9a61803d331639ab0c926a956d24211b65ac8090592643d20f440f24	2025-11-05 09:59:52.22782+00	20251105095951_add_wallet_and_wallet_transaction	\N	\N	2025-11-05 09:59:51.693379+00	1
df538c84-1071-4815-9283-c4bdce102173	ee4a9e37d874762fc6977a928c581ccb4468354489e5619b8be190a115afa222	2025-10-08 12:19:23.772852+00	20251008121922_remove_unique_representative_id	\N	\N	2025-10-08 12:19:23.506992+00	1
c216dcb7-82ef-47f7-85a9-6c0d80f50273	82fccffe51361d85dc3f255dbad7161474185eb0f357b8e1bed77407a86940f7	2025-10-09 07:56:10.740637+00	20251009075610_update_is_active_for_donor_profile	\N	\N	2025-10-09 07:56:10.585286+00	1
43bc32fc-139d-49a8-847b-d279a1b33e66	acba9aa3ed35dc0ab53234a75759a406601f9fa46aba1fe1925ff1a9104cc5e6	2025-12-08 02:52:43.36199+00	20251208025242_add_system_config_table	\N	\N	2025-12-08 02:52:42.765032+00	1
ee88616c-2dd0-47f3-a29a-d602723b874e	94410c8e2391a6524074e12a2e7c393d804691f07c8229d13975dfd5ab0199ba	2025-11-07 13:14:49.479645+00	20251107_add_wallet_types_and_transaction_types		\N	2025-11-07 13:14:49.479645+00	0
1380e9ca-e4ca-4cfb-bbd7-7c8227036191	634550c4ab171024093170100710465082cdc5427256aea451bad65792e3144f	2025-11-08 17:51:41.196425+00	20251109_add_related_payment_tracking		\N	2025-11-08 17:51:41.196425+00	0
2e2dd602-ef4b-426d-903f-c9a7db05ae7f	3db4d44cf643cf6250dadcfe0b002fcbb3cbedcfe7ed5c56501ef180420d2f44	2025-11-09 03:12:30.161108+00	20251109_remove_related_payment_id		\N	2025-11-09 03:12:30.161108+00	0
3959949a-18da-4b95-9d8f-62d30f81e9a9	2f194f07d33c29f4de366e67417872875ca5b712947c7c61d5de5496f371d920	2025-11-10 04:45:31.139288+00	20251105115032_fix_relationship_wallet_and_wallet_transaction		\N	2025-11-10 04:45:31.139288+00	0
af078456-643a-4f57-bf6f-5e447a949fcc	c3be0423b90c297297195e14038a036fe108de17d6984ebb238b9247d34fbcb7	2025-11-20 07:27:32.039559+00	20251120072731_add_total_donated_and_count_and_last_donation_time	\N	\N	2025-11-20 07:27:31.877333+00	1
7ec01ec3-d4fe-4909-b4fd-e4aff9d258bb	3f06c61b219af9f0512d839bd010fa5e7d716fc4ba945ddcba0b8e2ce6433f67	2025-11-10 04:46:10.179546+00	20251110044609_update_bank_field_in_organization	\N	\N	2025-11-10 04:46:09.841048+00	1
414ae768-5554-4ffb-b382-80826deeb511	c5f5aec67901e95fda0b6937f3200c7e1a916b9abcc046c590bde2872f90bab8	2025-11-24 10:49:52.785368+00	20251124104952_remove_donation_received_enum	\N	\N	2025-11-24 10:49:52.443568+00	1
5db221ec-4486-40e1-ba3f-9359212a26a4	a45f9288cf5d06262899de3ad320cd90caaf213dd3c98b24b59582c7dfa7ef3e	2025-11-28 15:22:29.752197+00	20251128152205_remove_unique_badge_id	\N	\N	2025-11-28 15:22:27.763845+00	1
\.


--
-- TOC entry 4573 (class 0 OID 18076)
-- Dependencies: 223
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.badges (id, name, description, icon_url, sort_order, is_active, created_at, updated_at) FROM stdin;
019a9c07-858d-746b-a4e8-bbd08388de6b	Quyên Góp Đầu Tiên	Cảm ơn bạn đã thực hiện quyên góp đầu tiên! Mỗi đóng góp đều tạo nên sự khác biệt.	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-19/5a4a55fd-temp-1763554500745-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	1	t	2025-11-19 12:12:09.999	2025-11-19 12:12:09.999
019a9c0b-6844-745c-92d3-e77f0454474f	Sao Đồng	Bạn đã quyên góp trên 100,000 VNĐ. Lòng hảo tâm của bạn thật đáng trân trọng!	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-19/52f4fe3a-temp-1763554198077-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	2	t	2025-11-19 12:16:24.646	2025-11-19 12:16:24.646
019a9c0d-be66-70ea-aa4d-b72875aa7143	Sao Bạc	Bạn đã quyên góp trên 1,000,000 VNĐ. Bạn đang tạo ra tác động thực sự!	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-19/4630d49d-temp-1763554651949-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	3	t	2025-11-19 12:18:57.768	2025-11-19 12:18:57.768
019a9c0f-4f84-716c-9929-217de8772f2c	Sao Vàng	Bạn đã quyên góp trên 10,000,000 VNĐ. Bạn là nhà vô địch của sự thay đổi!	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-19/9589d42c-temp-1763554761480-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	4	t	2025-11-19 12:20:40.453	2025-11-19 12:20:40.453
019a9c11-f621-7512-a78f-17683a147c80	Sao Bạch Kim	Bạn đã quyên góp trên 100,000,000 VNĐ. Tác động của bạn thật phi thường!	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-19/00d6a92f-temp-1763554955358-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	5	t	2025-11-19 12:23:34.179	2025-11-19 12:23:34.179
019a9c13-8728-7521-8bbf-9203b3be0cf5	Sao Kim Cương	Bạn đã quyên góp trên 500,000,000 VNĐ. Bạn là người hùng thực sự!	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-19/9cacd6c7-temp-1763555042152-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	6	t	2025-11-19 12:25:16.841	2025-11-19 12:25:16.841
019aa55d-5834-7509-9df9-e20d42603654	Test	Test descrip	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-21/5102df21-temp-1763711708207-f9aa955c-4051-709c-4ffc-005fd148ef48-1.png	10	f	2025-11-21 07:42:29.431	2025-11-21 08:19:39.512
019a9c27-a780-779e-a7be-208ee1c80bb4	lai la dg house	dopi data ne	https://foodfund.sgp1.cdn.digitaloceanspaces.com/badge-icons/2025-11-21/e3e32a62-temp-1763711718943-f9aa955c-4051-709c-4ffc-005fd148ef48-1.jpeg	9	f	2025-11-19 12:47:15.843	2025-11-21 08:19:45.033
\.


--
-- TOC entry 4576 (class 0 OID 18857)
-- Dependencies: 226
-- Data for Name: organization_members; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.organization_members (id, organization_id, member_id, status, member_role, joined_at, left_at) FROM stdin;
22a2d682-f8c4-41de-b81c-87e2968dc0fd	3b8313f0-09d2-4b86-bf4c-23cfefeae809	01997f50-e6bd-7008-ab05-2bee8167ed4a	VERIFIED	FUNDRAISER	2025-10-09 07:20:16.877	\N
1437f869-854e-4122-aafa-39ec3fd6773a	3b8313f0-09d2-4b86-bf4c-23cfefeae809	0199c864-8cea-7409-beb2-97e90fce98bf	REJECTED	KITCHEN_STAFF	2025-10-09 10:20:28.374	\N
96fc1c22-bd76-40c4-90d4-ed2459511ee5	ecb3e803-18c2-48a8-b450-f665d62128b8	019ae3ae-21df-764a-9b1d-45ff8c61a696	VERIFIED	DELIVERY_STAFF	2025-12-03 10:08:27.683	\N
6394d3c8-c13d-466d-a390-37243b4d3188	1c017129-7db6-42f5-99d7-5d209dfc1087	0199e599-5573-754a-9572-fdf8e68ae301	VERIFIED	FUNDRAISER	2025-10-15 08:31:01.624	\N
417d1c8d-cef6-4569-b5af-418fcf1752b0	912bdb9f-b167-49b0-89c2-3495ffbad0dc	0199dec4-4e5c-73fe-a51c-680b7450c3f3	VERIFIED	FUNDRAISER	2025-12-03 13:01:59.543	\N
5bb59e56-a495-4588-8805-0eff571f3e33	69d6e983-61aa-4eda-b1b8-fc72329e033a	019ae471-5143-775e-a294-f2c480fc354b	VERIFIED	FUNDRAISER	2025-12-03 14:04:10.489	\N
44e22681-890b-49f5-86ae-742cdde4560a	eb590ab7-df52-4201-85c1-645dd9f626a4	019a7200-0e85-702c-9a94-34214d36cac1	VERIFIED	FUNDRAISER	2025-11-11 10:30:38.964	\N
1f47b7d0-f29b-477c-810d-558d16ac6324	725efdad-4e50-48df-8c57-4af0de83d68b	019a481a-612a-74e1-aa1d-764e11f0c593	VERIFIED	FUNDRAISER	2025-11-20 07:02:35.823	\N
24692f95-38ab-4c99-9c75-8f1264aa2232	cb815b0e-90fd-4add-8132-373e53bf3dda	019ac55c-0903-7685-b3cf-abee461fcd6b	VERIFIED	FUNDRAISER	2025-11-27 13:01:54.381	\N
4c8066c2-b2c1-4dc4-8baf-6251b9907904	1c017129-7db6-42f5-99d7-5d209dfc1087	0199dec4-4e5c-73fe-a51c-680b7450c3f3	REJECTED	DELIVERY_STAFF	2025-11-30 08:12:00.199	\N
eeb2bc4a-0246-45cf-a68b-354f2a014f58	69d6e983-61aa-4eda-b1b8-fc72329e033a	019ae48b-f21f-7399-9d7b-43553640a247	VERIFIED	DELIVERY_STAFF	2025-12-03 14:10:05.111	\N
b0a8d2eb-a061-4f71-a63c-619dec908571	1c017129-7db6-42f5-99d7-5d209dfc1087	0199dec4-4e5c-73fe-a51c-680b7450c3f3	REJECTED	DELIVERY_STAFF	2025-11-30 08:19:58.828	2025-11-30 08:23:21.079
db633bbe-78e4-4310-a76f-1126d402f6f4	725efdad-4e50-48df-8c57-4af0de83d68b	019a0b2c-48be-752f-96a7-0aacf3953ce5	VERIFIED	KITCHEN_STAFF	2025-12-02 08:35:07.496	\N
ec7a8a4a-b5de-48c5-ad19-e2d3e5011165	ecb3e803-18c2-48a8-b450-f665d62128b8	019a9c36-cd29-734b-ade1-d6e7704c7752	VERIFIED	FUNDRAISER	2025-12-02 13:10:04.382	\N
2723c584-1ba8-466a-93c8-f15cb263b5c9	ecb3e803-18c2-48a8-b450-f665d62128b8	019adf96-6785-7429-b141-ae5ca119cb0a	VERIFIED	KITCHEN_STAFF	2025-12-02 15:04:03.225	\N
d51445a0-bace-4c0b-ae16-3048da12723d	1c017129-7db6-42f5-99d7-5d209dfc1087	019ae1ea-8076-77fe-a326-f5333ea851db	VERIFIED	DELIVERY_STAFF	2025-12-03 02:36:22.081	\N
66291bc0-5350-4578-a732-50f421c96ea4	69d6e983-61aa-4eda-b1b8-fc72329e033a	019ae48a-b828-7162-af69-f49d5bae5bc6	VERIFIED	KITCHEN_STAFF	2025-12-03 14:08:41.198	\N
8c27f333-d27f-4809-b378-1298186f2590	1c017129-7db6-42f5-99d7-5d209dfc1087	019ae214-22d0-748e-9675-484ab3cf428e	REJECTED	KITCHEN_STAFF	2025-12-03 03:21:10.26	2025-12-03 03:38:37.77
8751177b-0849-47b7-a30a-d604d0420887	1c017129-7db6-42f5-99d7-5d209dfc1087	019ae214-22d0-748e-9675-484ab3cf428e	VERIFIED	KITCHEN_STAFF	2025-12-03 03:39:15.161	\N
643aaac9-2578-4d13-8164-af85742925c2	eb590ab7-df52-4201-85c1-645dd9f626a4	0199841f-34e9-73b1-a29a-e1b66350d018	REJECTED	KITCHEN_STAFF	2025-11-11 12:12:00.915	2025-12-04 13:57:44.263
d5de6202-27b6-4d8d-9ff0-392af4a2e35f	eb590ab7-df52-4201-85c1-645dd9f626a4	019a72dc-33bb-73a5-b57b-e07621d7d13e	REJECTED	DELIVERY_STAFF	2025-11-11 14:35:06.541	2025-12-04 14:58:32.281
4208ea8f-2bb8-44bd-9fee-821fcb56dac4	2ebfb7ae-2dac-47d2-ab0e-8229be785e66	019ae7af-3186-734c-9b24-fe5ce8819e4f	VERIFIED	FUNDRAISER	2025-12-05 14:41:10.26	\N
27661023-c7fd-4b01-8c99-15de59407e3e	eb590ab7-df52-4201-85c1-645dd9f626a4	0199841f-34e9-73b1-a29a-e1b66350d018	VERIFIED	KITCHEN_STAFF	2025-12-07 08:34:15.099	\N
\.


--
-- TOC entry 4575 (class 0 OID 18848)
-- Dependencies: 225
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.organizations (id, name, activity_field, address, website, description, representative_id, representative_name, representative_identity_number, email, phone_number, created_at, updated_at, status, bank_account_name, bank_account_number, bank_name, bank_short_name, reason) FROM stdin;
131eca45-0bb4-41bb-8b9d-199aa183a6ab	Minh Phước	Từ thiện	329 lo e duong lo gom 123213	minhphuoc.io	quỹ từ thiện Minh Phước dep trai	0199dec4-4e5c-73fe-a51c-680b7450c3f3	TRƯƠNG MINH PHƯỚC	111222333332	minnphuocdeptrai@gmail.com	+84901308975	2025-11-10 11:51:00.723	2025-11-10 11:58:54.719	REJECTED	TRUONG MINH PHUOC	222333112323123	VCB	Ngân hàng TMCP Ngoại Thương Việt Nam	tổ chức này không liêm
eb590ab7-df52-4201-85c1-645dd9f626a4	Tổ chức Cứu Trợ Thực Phẩm HCM	Hỗ trợ lương thực cộng đồng	123 Đường A, Quận 1, TP.HCM	https://cuutro.example.org	Tổ chức phi lợi nhuận chuyên cung cấp suất ăn cho người nghèo.	019a7200-0e85-702c-9a94-34214d36cac1	Nguyễn Văn A	111222333332	foodfund.balancing730@aleeas.com	+84901308975	2025-11-11 10:29:10.56	2025-11-11 10:30:38.595	VERIFIED	Nguyễn Văn A	222333112323123	VCB	Ngân hàng TMCP Ngoại Thương Việt Nam	\N
725efdad-4e50-48df-8c57-4af0de83d68b	Quỹ thiện nguyện Nhật Hoàng	Thiện nguyện	TỔ 2 KHU PHỐ 1, QUYẾT THẮNG, THÀNH PHỐ BIÊN HÒA, ĐỒNG NAI		Ánh mặt trời	019a481a-612a-74e1-aa1d-764e11f0c593	HUỲNH LÊ NHẬT HOÀNG	075203008284	29.hoang.10@gmail.com	+84939023883	2025-11-20 05:44:50.532	2025-11-20 07:02:35.04	VERIFIED	HUYNH LE NHAT HOANG	06544693401	Ngân hàng TMCP Tiên Phong	TPB	\N
3b8313f0-09d2-4b86-bf4c-23cfefeae809	Minh Phước	Từ thiện	30 Nguyễn Trãi, phường 7, quận 5	minhphuoc.io.vn	quỹ từ thiện Minh Phước	01997f50-e6bd-7008-ab05-2bee8167ed4a	Trương Minh Phước	111222333332	sophiaconstance2570@gmail.com	+84901308975	2025-10-08 12:23:24.506	2025-10-09 07:20:16.306	VERIFIED	PHAN CANH BAO DUY	00001297469	Ngân hàng TMCP Tiên Phong	TPBank	\N
e1c40881-db3c-474e-ac5e-00e60007971f	Minh Phước	Từ thiện	329 lo e duong lo gom	minhphuoc.io	quỹ từ thiện Minh Phước dep trai	0199dec4-4e5c-73fe-a51c-680b7450c3f3	TRƯƠNG MINH PHƯỚC	111222333332	minnphuocdeptrai@gmail.com	+84901308975	2025-11-10 11:21:09.547	2025-11-10 11:47:46.009	CANCELLED	TRUONG MINH PHUOC	222333112323123	VCB	Ngân hàng TMCP Ngoại Thương Việt Nam	Cancelled by user
cb815b0e-90fd-4add-8132-373e53bf3dda	Tổ chức Cứu Trợ Thực Phẩm Hồ Chí Minh	Hỗ trợ lương thực cộng đồng	123 Đường A, Quận 1, TP.HCM	https://cuutro.example.org	Tổ chức phi lợi nhuận chuyên cung cấp suất ăn cho người nghèo.	019ac55c-0903-7685-b3cf-abee461fcd6b	Huỳnh Văn A	111222333335	foodfund.last929@aleeas.com	+84901308253	2025-11-27 13:00:08.036	2025-11-27 13:01:53.466	VERIFIED	Huỳnh Văn A	1022292912	VCB	Ngân hàng TMCP Ngoại Thương Việt Nam	\N
ecb3e803-18c2-48a8-b450-f665d62128b8	Trung tâm Từ Thiện Quận 3	Từ thiện	280/29/20/15 BÙI HỮU NGHĨA, P 2, Q BÌNH THẠNH, TP TP HỒ CHÍ MINH		Trung tâm Từ Thiện Quận 3, cho các hoạt động xoay quanh quận 3	019a9c36-cd29-734b-ade1-d6e7704c7752	PHAN CẢNH BẢO DUY	046204000183	phbaoduy2004@gmail.com	+84938848615	2025-12-02 13:08:41.022	2025-12-02 13:10:04.336	VERIFIED	PHAN CANH BAO DUY	0938848615	Ngân hàng TMCP Quân đội	MB	\N
69d6e983-61aa-4eda-b1b8-fc72329e033a	Đại Học FPT (TP.Hồ Chí Minh)	Giáo Dục	280/29/20/15 BÙI HỮU NGHĨA, P02, BÌNH THẠNH, TP HỒ CHÍ MINH		Đại Học FPT (TP.Hồ Chí Minh)	019ae471-5143-775e-a294-f2c480fc354b	LÊ THỊ LIỄU	046176014361	lieule208@gmail.com	+84937904658	2025-12-03 14:03:19.038	2025-12-03 14:04:10.459	VERIFIED	LE THI LIEU	904658	Ngân hàng TMCP Á Châu	ACB	\N
912bdb9f-b167-49b0-89c2-3495ffbad0dc	Tổ chức Cứu Trợ Thực Phẩm Hồ Chí Minh	Hỗ trợ lương thực cộng đồng cua	123 Đường Aaaaaaaaaaqaaaaaa, Quận 1, TP.HCM	https://cuutro.example.org	Tổ chức phi lợi nhuận chuyên cung cấp suất ăn cho người nghèo.	0199dec4-4e5c-73fe-a51c-680b7450c3f3	Huỳnh Văn A	111222333335	foodfund.last929@aleeas.com	+84901308253	2025-11-27 13:33:25.691	2025-12-03 13:01:59.076	VERIFIED	Huỳnh Văn A	1022292912	VCB	Ngân hàng TMCP Ngoại Thương Việt Nam	\N
1c017129-7db6-42f5-99d7-5d209dfc1087	Nguyễn Ngọc Tuấn	Từ thiện	30 Nguyễn Trãi, phường 7, quận 5	minhphuoc.io.vn	quỹ từ thiện Minh Phước	0199e599-5573-754a-9572-fdf8e68ae301	Trương Minh Phước	111222333332	sophiaconstance2570@gmail.com	+84328858147	2025-10-15 04:42:43.198	2025-10-15 08:31:00.464	PENDING	PHAN CANH BAO DUY	00001297469	Ngân hàng TMCP Tiên Phong	TPBank	\N
2ebfb7ae-2dac-47d2-ab0e-8229be785e66	Quỹ từ thiện mới	Giáo dục	280/29/20/15 BÙI HỮU NGHĨA, PHƯỜNG 2, BÌNH THẠNH, TP.HỒ CHÍ MINH		ok	019ae7af-3186-734c-9b24-fe5ce8819e4f	PHAN CẢNH BẢO DUY	046204000183	skyglaze09111@gmail.com	+84938848848	2025-12-05 14:40:42.755	2025-12-05 14:41:10.236	VERIFIED	PHAN CANH BAO DUY	0938848615	Ngân hàng TMCP Quân đội	MB	\N
1b9a82d5-ba31-4cf7-b6eb-3a44cb288114	Minh Phước	Từ thiện	329 lo e duong lo gom real man	minhphuoc.io	quỹ từ thiện Minh Phước dep trai	0199dec4-4e5c-73fe-a51c-680b7450c3f3	TRƯƠNG MINH PHƯỚC	111222333332	minnphuocdeptrai@gmail.com	+84901308975	2025-11-10 11:59:15.074	2025-11-27 13:18:06.382	PENDING	TRUONG MINH PHUOC	222333112323123	VCB	Ngân hàng TMCP Ngoại Thương Việt Nam	Cancelled by user
\.


--
-- TOC entry 4579 (class 0 OID 87139)
-- Dependencies: 232
-- Data for Name: system_configs; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.system_configs (key, value, description, data_type, updated_at) FROM stdin;
MIN_FUNDING_PERCENTAGE	60	Minimum funding percentage required for campaign success	NUMBER	2025-12-08 03:30:02.373
\.


--
-- TOC entry 4574 (class 0 OID 18086)
-- Dependencies: 224
-- Data for Name: user_badges; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.user_badges (id, user_id, badge_id, awarded_at) FROM stdin;
49f97569-1581-47b8-a812-e0fda76b10cf	0199dec4-4e5c-73fe-a51c-680b7450c3f3	019a9c0b-6844-745c-92d3-e77f0454474f	2025-11-20 08:43:07.427
019ac454-6759-76cf-997e-1c9de8e26eb4	0199e599-5573-754a-9572-fdf8e68ae301	019a9c07-858d-746b-a4e8-bbd08388de6b	2025-11-27 08:00:57.18
019adff2-4eda-703f-bd3f-45b0b1f50299	019adf96-6785-7429-b141-ae5ca119cb0a	019a9c0b-6844-745c-92d3-e77f0454474f	2025-12-02 16:43:10.428
019ae473-6d79-752a-b327-4cf4ec5e8e20	019ae471-5143-775e-a294-f2c480fc354b	019a9c07-858d-746b-a4e8-bbd08388de6b	2025-12-03 13:42:41.274
019ae78d-5fed-72ea-84be-809ea10a20d4	019a9c36-cd29-734b-ade1-d6e7704c7752	019a9c0b-6844-745c-92d3-e77f0454474f	2025-12-04 04:09:53.391
019ae803-14e8-74a8-b5a3-8c630a7030b0	019ae801-6412-707f-aefb-014cccb869ba	019a9c07-858d-746b-a4e8-bbd08388de6b	2025-12-04 06:18:27.467
019b0729-ff1c-71e0-aa70-b08ec1439c10	019a7200-0e85-702c-9a94-34214d36cac1	019a9c07-858d-746b-a4e8-bbd08388de6b	2025-12-10 07:29:11.456
\.


--
-- TOC entry 4572 (class 0 OID 16503)
-- Dependencies: 222
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.users (id, full_name, avatar_url, email, phone_number, role, is_active, user_name, bio, created_at, updated_at, cognito_id, address, donation_count, last_donation_at, total_donated) FROM stdin;
019a72dc-33bb-73a5-b57b-e07621d7d13e	Luyện Delivery Staff		luyenhdse172341@fpt.edu.vn	\N	DONOR	t	luyenhdse17234		2025-11-11 12:20:25.152	2025-12-04 14:58:32.294	a9cad55c-d051-701e-38c0-df1a299616e7	\N	0	\N	0
0199c864-8cea-7409-beb2-97e90fce98bf	Truong Minh Phuoc		phuoctmse184067@fpt.edu.vn	\N	DONOR	t	phuoctmse18406		2025-10-09 09:54:17.718	2025-10-22 08:54:50.906	992a756c-c001-702c-a168-f8aca0ee2ae1	\N	0	\N	0
019a0c08-fef6-778d-8fa2-447cc6e46aab	Truong Phuoc		truongphuoc0981@gmail.com	\N	DONOR	t	truongphuoc098		2025-10-22 13:08:27.521	2025-10-22 13:08:27.521	d9aaa5dc-d051-70d5-8ae9-4ac90f99cdb3	\N	0	\N	0
019a0b2c-48be-752f-96a7-0aacf3953ce5	Nguyễn Linh	https://lh3.googleusercontent.com/a/ACg8ocI__f5u3TXC1fCqPONY8lNBlJfyNuo1TItBDwY4MBOinG98-qE=s96-c	nguyenngocthuylinh234@gmail.com	\N	KITCHEN_STAFF	t	nguyenngocthuy		2025-10-22 09:07:22.953	2025-12-02 10:19:52.919	b94ae5bc-c021-7070-0ba5-5c772f08ca70	\N	0	\N	0
019ae48b-f21f-7399-9d7b-43553640a247	DeliveryStaff1		food-fund.anybody439@passinbox.com	\N	DELIVERY_STAFF	t	foodfundanybod		2025-12-03 14:09:28.096	2025-12-03 14:10:39.008	391a655c-0051-70fa-1eb0-d660c43e124f	\N	0	\N	0
01997f51-7a0f-7767-be67-e69fd0e6e2c2	Truong Minh Phuoc		phuoctm0707@example.com	+84901308975	DONOR	t	phuoctm0707_example		2025-09-25 05:21:10.161	2025-09-25 05:21:10.161	d91a054c-90a1-7064-4928-c4fb6b2523f4	\N	0	\N	0
01997f5f-8681-759b-8020-386a0d2228c1	Truong Minh Phuoc		phuoctm0707@fpt.edu.vn	\N	DONOR	t	phuoctm0707_fpt		2025-09-25 05:36:30.851	2025-09-25 05:36:30.851	f99ab58c-0081-70a3-9c03-272faafa4486	\N	0	\N	0
01997f60-e484-7689-8dc4-c490881e14af	Truong Minh Phuoc		phuoctm0707@example.vn	\N	DONOR	t	phuoctm07071		2025-09-25 05:38:00.454	2025-09-25 05:38:00.454	a9fad59c-6061-70be-7a58-6d514a907fe0	\N	0	\N	0
01997f70-1eb3-71bf-8ec2-23e5a051a6d0	Truong Minh Phuoc		phuoctm0707@example.io.vn	\N	DONOR	t	phuoctm0707noyr		2025-09-25 05:54:38.39	2025-09-25 05:54:38.39	498a957c-9021-709c-94b8-68f0eca89ee2	\N	0	\N	0
019ac55c-0903-7685-b3cf-abee461fcd6b	Testing Fundraiser		foodfund.last929@aleeas.com	\N	FUNDRAISER	t	foodfundlast92		2025-11-27 12:48:54.561	2025-11-27 13:01:54.123	d97ae5fc-3081-705a-cba2-9f7637675e4c	\N	0	\N	0
01997f50-e6bd-7008-ab05-2bee8167ed4a	Minh Phuoc cap	\N	phuoctm0707@gmail.com	+84901308975	FUNDRAISER	t	phuoctm0707	nha toi ne 123123213	2025-09-25 05:20:32.447	2025-10-09 07:20:16.551	49baa53c-e0d1-70b8-a1e6-7381165b878d	\N	0	\N	0
01997eeb-6f67-7a46-87e2-e44f0a51ebe0	Admin	https://foodfund.sgp1.cdn.digitaloceanspaces.com/user-avatars/2025-12-05/0d45e5ee-temp-1764921912341-01997eeb-6f67-7a46-87e2-e44f0a51ebe0-1.jpeg	admin@gmail.com	+84901308975	ADMIN	t	admin		2025-09-25 03:25:38.534	2025-12-05 08:05:16.768	f9aa955c-4051-709c-4ffc-005fd148ef48	\N	0	\N	0
019a9f9b-4b37-7377-a50b-fafff52130c9	vie		a@gmail.com	\N	DONOR	t	a		2025-11-20 04:52:26.098	2025-11-20 04:52:26.098	f94ac53c-8011-70b4-e798-605c33a84f80	\N	0	\N	0
019a481a-612a-74e1-aa1d-764e11f0c593	Nhat Hoang		29.hoang.10@gmail.com	\N	FUNDRAISER	t	29hoang10		2025-11-03 05:04:39.726	2025-11-20 07:02:35.704	093a850c-9071-7022-834c-6e87976abadb	\N	0	\N	0
019ac90a-fe0a-750e-9756-06cdfcf59d57	Nhật Phí	https://lh3.googleusercontent.com/a/ACg8ocLkcTKzaVLynr4b0Ouoj2YkOPdtDeSBpjIU3YSIVu-3Mb89yQ=s96-c	nhatphi3369@gmail.com	\N	DONOR	t	nhatphi3369		2025-11-28 05:58:52.172	2025-11-28 05:58:52.172	a93a15ec-4051-70c7-ebec-c5fd007c574c	\N	0	\N	0
019ae214-22d0-748e-9675-484ab3cf428e	Hoàng Kitch		foodfund.book779@passinbox.com	\N	KITCHEN_STAFF	t	foodfundbook77		2025-12-03 02:39:21.81	2025-12-03 03:39:23.428	991a755c-b011-7040-d0a9-2ffcac48e46a	\N	0	\N	0
0199dec4-4e5c-73fe-a51c-680b7450c3f3	Minh Phuoc Feda	https://foodfund.sgp1.cdn.digitaloceanspaces.com/user-avatars/2025-11-23/0902d0cd-temp-1763909967378-0199dec4-4e5c-73fe-a51c-680b7450c3f3-1.jpeg	phuoc9111@gmail.com	\N	FUNDRAISER	t	phuoc9111		2025-10-13 18:10:31.764	2025-12-03 13:01:59.44	897a759c-b0f1-70b9-516c-ee61af672c56		14	2025-11-28 14:18:39.452	163000
019ae433-cd43-7666-b43b-83ebf01deeee	Hoàng Fundraiser		food-fund.persuaded015@passinbox.com	\N	DONOR	t	foodfundpersua		2025-12-03 12:33:11.495	2025-12-03 12:50:38.976	29da858c-f011-703f-646a-c5d84ddff04d	\N	0	\N	0
019ae1ea-8076-77fe-a326-f5333ea851db	Hoàng Deli		food-fund.vercel.app.silver877@passinbox.com	\N	DELIVERY_STAFF	t	foodfundvercel		2025-12-03 01:53:53.273	2025-12-03 02:38:01.879	d93a05cc-2001-70ab-0c7e-2f52e22b7ce4	\N	0	\N	0
0199e599-5573-754a-9572-fdf8e68ae301	Huỳnh Lê Nhật Hoàng	https://foodfund.sgp1.cdn.digitaloceanspaces.com/user-avatars/2025-11-30/749bd0ce-temp-1764492274536-0199e599-5573-754a-9572-fdf8e68ae301-1.png	hoanghlnse172474@fpt.edu.vn	+84939023883	FUNDRAISER	t	hoanghlnse1724		2025-10-15 02:00:55.413	2025-11-30 08:44:38.988	d96ae52c-1031-70ec-91a7-8a77026ec88c		5	2025-11-28 15:25:45.903	10000
019adf96-6785-7429-b141-ae5ca119cb0a	Tuan	https://foodfund.sgp1.cdn.digitaloceanspaces.com/user-avatars/2025-12-03/6e499c49-temp-1764752439680-019adf96-6785-7429-b141-ae5ca119cb0a-1.jpeg	duypcbse184173@fpt.edu.vn	\N	KITCHEN_STAFF	t	duypcbse184173		2025-12-02 15:02:47.435	2025-12-03 09:21:17.182	696a959c-c031-701c-085a-ff780e5b0f07		1	2025-12-02 16:43:10.189	200000
0199debb-5b9a-7686-ab27-1dd838d5586f	King Curry	https://lh3.googleusercontent.com/a/ACg8ocLyMvfBCxLCa-kQb4wRsRBXVQtukWouj7KgJ_F2w3ux05TOvw=s96-c	kingcurry099@gmail.com	\N	DONOR	t	kingcurry099		2025-10-13 18:00:45.384	2025-10-13 18:00:45.384	199ae57c-5041-70cb-25c5-e6dd6fd9b894	\N	0	\N	0
019ae3ae-21df-764a-9b1d-45ff8c61a696	phu		skyglaze911@gmail.com	\N	DELIVERY_STAFF	t	skyglaze911		2025-12-03 10:07:11.329	2025-12-03 10:09:30.596	598ae5fc-7011-70fd-ba2b-395140365cb0	\N	0	\N	0
019ae48a-b828-7162-af69-f49d5bae5bc6	KitchenStaff1		food-fund.tweak643@passinbox.com	\N	KITCHEN_STAFF	t	foodfundtweak6		2025-12-03 14:08:07.722	2025-12-03 14:10:40.54	a9ea353c-a0e1-70dc-c360-7e8efc3cf556	\N	0	\N	0
019ae471-5143-775e-a294-f2c480fc354b	Du Vân		duvan20040911@gmail.com	\N	FUNDRAISER	t	duvan20040911		2025-12-03 13:40:22.981	2025-12-03 15:54:36.453	59ca659c-60c1-70d7-23dd-3a26a0c5df58	\N	3	2025-12-03 15:54:36.444	6000
019a9c36-cd29-734b-ade1-d6e7704c7752	Duy		phbaoduy2004@gmail.com	\N	FUNDRAISER	t	phbaoduy2004		2025-11-19 13:03:48.523	2025-12-04 04:09:53.009	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	\N	1	2025-12-04 04:09:52.999	100000
019ae804-de3e-77b4-b6ae-d4860c5b4236	deli staff		foodfund.proton462@passinbox.com	\N	DELIVERY_STAFF	t	foodfundproton		2025-12-04 06:20:24.511	2025-12-04 06:28:54.647	792a351c-c041-70d3-e86a-b35ba60643e5	\N	0	\N	0
019ae801-6412-707f-aefb-014cccb869ba	Fundraiser		foodfund.decompose767@passinbox.com	\N	FUNDRAISER	t	foodfunddecomp		2025-12-04 06:16:36.628	2025-12-04 06:26:52.3	c9ea352c-00d1-706a-26f3-236361e805d4	\N	1	2025-12-04 06:18:27.053	2000
019ae803-f9a7-7199-89dd-a6a1aefea826	kitchen sta		foodfund.refold785@passinbox.com	\N	KITCHEN_STAFF	t	foodfundrefold		2025-12-04 06:19:25.992	2025-12-04 06:28:56.253	b9dad5cc-60a1-7014-cd42-30d85014b0a3	\N	0	\N	0
019aeeca-8bb0-7079-b06f-42781267b547	Fundraiser01		duy179066@gmail.com	\N	DONOR	t	duy179066		2025-12-05 13:54:02.802	2025-12-05 13:54:02.802	e96a45fc-90c1-700b-30c5-ae67f98886c9	\N	0	\N	0
019aeecd-ef60-72fc-9518-d877e790f367	KitchenStaff01		suwonclone@gmail.com	\N	DONOR	t	suwonclone		2025-12-05 13:57:44.93	2025-12-05 13:57:44.93	b97a453c-40c1-7013-45ab-a93fa3988d7c	\N	0	\N	0
019aeece-d3b4-75ae-aa71-2e6815db5e1d	DeliveryStaff01		tieuvyvy12304@gmail.com	\N	DONOR	t	tieuvyvy12304		2025-12-05 13:58:43.382	2025-12-05 13:58:43.382	395a958c-c091-70b9-d811-d57ad0ef2a98	\N	0	\N	0
0199841f-34e9-73b1-a29a-e1b66350d018	Huỳnh Đình Luyện	https://foodfund.sgp1.cdn.digitaloceanspaces.com/user-avatars/2025-11-25/29844122-temp-1764088236702-0199841f-34e9-73b1-a29a-e1b66350d018-1.jpeg	huynhdinhluyen@gmail.com	+84939202348	KITCHEN_STAFF	t	huynhdinhluyen	Tôi là nhà ủng hộ đỉnh nhất  Việt Nam	2025-09-26 03:44:21.755	2025-12-07 08:35:05.812	093ab54c-70f1-7008-1d8d-05adf6fc8748	123 Hưng Đạo Vương, Phường Thống Nhất, Tỉnh Đồng Nai	0	\N	0
019ae7af-3186-734c-9b24-fe5ce8819e4f	DeliveryStaff2		skyglaze09111@gmail.com	\N	FUNDRAISER	t	skyglaze09111		2025-12-04 04:46:49.736	2025-12-05 14:41:10.252	09ea755c-c091-7052-6074-f95132304af6	\N	0	\N	0
019a7200-0e85-702c-9a94-34214d36cac1	Luyện Fundraiser		foodfund.balancing730@aleeas.com	+84938254133	FUNDRAISER	t	foodfundbalanc		2025-11-11 08:19:57.748	2025-12-10 07:29:11.41	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	2	2025-12-10 07:29:11.383	4000
\.


--
-- TOC entry 4578 (class 0 OID 31600)
-- Dependencies: 228
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.wallet_transactions (id, wallet_id, campaign_id, amount, created_at, payment_transaction_id, transaction_type, description, gateway, sepay_metadata, balance_after, balance_before) FROM stdin;
031c029c-f9a4-4304-b97c-1b3640901f68	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	6114ee01-0a44-44f9-a7ee-e23e2a9f7575	200000	2025-12-02 16:43:10.134	4773a30a-91ee-4294-9c6e-a0468a013423	INCOMING_TRANSFER	109420232682-0938848615-CSHY10XCNK2 1764693766302580	\N	null	210000	10000
ed7dafb6-7fbe-416f-8486-55f6ddca3b47	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	83500	2025-12-03 03:18:04.686	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify 7978830669 Phan Can-031225-10:18:03 493889	ACB	{"id": 33669134, "code": null, "content": "7978830669 Phan Can-031225-10:18:03 493889", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify 7978830669 Phan Can-031225-10:18:03 493889", "transferType": "out", "accountNumber": "", "referenceCode": "4129", "transferAmount": 83500, "transactionDate": "2025-12-03 10:18:03"}	126500	210000
39505f20-4fd6-41c1-9c7f-31a4e4e0b6f1	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	2025-12-03 15:54:31.969	f5805e77-69b7-4f39-9da6-9063ba59313f	INCOMING_TRANSFER	109545731033-0938848615-CSZQBPPJCL0 1764777237835498	\N	null	143500	141500
4fba22a6-7c7e-4f92-83bf-189675e4ec5d	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	14ad34dc-dc0c-42f8-868c-237fe766ca9a	100000	2025-12-04 04:09:51.022	bf2668f3-4d9e-4624-8a7a-6d8d66767f7e	INCOMING_TRANSFER	CS4E6SL6K36 1764821370502467	\N	null	243500	143500
d812c604-368e-4e60-b7b6-55bf54e9c265	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	cc29b597-e75e-4a62-8258-5b1fced63534	500000	2025-12-04 04:48:26.334	1aa4c241-2eef-43eb-8b57-169ec2c8acf0	INCOMING_TRANSFER	CSJM3FMP3P2 1764823680515907	\N	null	743500	243500
7c563378-62a2-434c-9d5b-a6cdd288c4c2	154cc209-00c0-4cf0-aefc-d4a4be7874dd	cc29b597-e75e-4a62-8258-5b1fced63534	280000	2025-12-04 04:48:30.365	3278fa42-f725-4030-a166-bdc64dbac497	ADMIN_ADJUSTMENT	Ngân sách tồn dư của chiến dịch: Quỹ nấu cơm hằng tuần (Tồn dư: 280000 VND)	\N	null	280000	0
a4b18dff-081b-4bac-947d-8e61ce977d91	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	20000	2025-12-02 14:40:10.026	\N	INCOMING_TRANSFER	ZP74EU33SEVG, Phuoc dung Zalopay chuyen tien GD 5336BIDVE2ARK48D 021225-21:40:08	SEPAY	{"content": "ZP74EU33SEVG, Phuoc dung Zalopay chuyen tien GD 5336BIDVE2ARK48D 021225-21:40:08", "sepayId": 33611562, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify ZP74EU33SEVG, Phuoc dung Zalopay chuyen tien GD 5336BIDVE2ARK48D 021225-21:40:08", "referenceCode": "4125", "transactionDate": "2025-12-02 21:40:09"}	20000	0
fc6a2629-543a-4842-97df-1b1f4f460cda	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	2025-12-03 11:29:10.192	aacd5c0c-7ec6-4a85-8277-aa3edb7d19bc	INCOMING_TRANSFER	CSURDJVM9X0 1764761122654414	\N	null	128500	126500
8ab09cf2-5535-430c-b404-27e99a17076f	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	2025-12-03 11:29:12.475	c9025bc0-0a90-4646-b817-e9926c16e4d0	INCOMING_TRANSFER	CSURDJVM9X0 1764761122654414	\N	null	130500	128500
489f6c36-0ba1-4f57-adfd-451b5d91480f	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	3000	2025-12-03 11:42:15.13	0d815d0c-07c6-4dc8-989b-4a1c8ad28e4f	INCOMING_TRANSFER	CSIO67EZD47 1764761976102683	\N	null	133500	130500
83818e6b-0d7a-477e-8d63-8d3f4162dc8f	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	4000	2025-12-03 12:01:55.1	cf085fe4-8be8-4b3c-aa37-4db8b071babb	INCOMING_TRANSFER	CS2RPG7O6E9 1764763278844666	\N	null	137500	133500
6945335c-10f2-41b7-a468-32f62feedd6d	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	2025-12-03 13:42:40.252	f57327e8-550a-4983-859e-5518a8950304	INCOMING_TRANSFER	CSKYZVPJNP2 1764769326700969	\N	null	139500	137500
cf23c215-ba84-44d2-87ba-e243c2cfd554	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	2025-12-03 13:50:46.632	9439d646-6de1-4dd9-9b66-97ab1889a115	INCOMING_TRANSFER	CS7N0BXN517 1764769812156863	\N	null	141500	139500
1108886b-fa64-47b6-9068-1fb8cf9fe5fb	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	10000	2025-12-02 14:43:42.861	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng ok - BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-021225-21:43:39 899185	ACB	{"id": 33612112, "code": null, "content": "PHAN CANH BAO DUY CHUYEN KHOAN-021225-21:43:39 899185", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-021225-21:43:39 899185", "transferType": "out", "accountNumber": "", "referenceCode": "4126", "transferAmount": 10000, "transactionDate": "2025-12-02 21:43:39"}	10000	20000
ea446116-bc18-4259-8cc7-5e4da7efde56	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	50000	2025-12-04 05:22:28.308	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109601976664 - 04122025 12:22:27 976664	ACB	{"id": 33835006, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109601976664 - 04122025 12:22:27 976664", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109601976664 - 04122025 12:22:27 976664", "transferType": "out", "accountNumber": "", "referenceCode": "4139", "transferAmount": 50000, "transactionDate": "2025-12-04 12:22:27"}	693500	743500
47d1bbc7-e584-47f0-abcf-0891a275004a	154cc209-00c0-4cf0-aefc-d4a4be7874dd	07cf05f5-0be5-46f0-bd83-83ed9dd5f679	60000	2025-12-04 05:30:18.305	\N	WITHDRAWAL	Tự động chuyển tiền vào chiến dịch "Cơ sở Lê Lợi" khi được phê duyệt	\N	{}	20000	80000
5484c225-4cdd-4635-95f7-e46c08ae887a	154cc209-00c0-4cf0-aefc-d4a4be7874dd	717beed7-cf9f-40de-912f-88ab1a883222	200000	2025-12-04 05:19:46.244	\N	WITHDRAWAL	Tự động chuyển tiền vào chiến dịch "Học sinh trường Chu Văn An" khi được phê duyệt	\N	{}	80000	280000
11a6656d-fb32-4b5f-acaf-1a7a11d8f49b	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	2025-12-04 06:18:26.466	019fd51e-423a-4e30-8731-a5ec89b176c9	INCOMING_TRANSFER	109608560361-0938848615-CSGNX74Z4V3 1764829081351836	\N	null	695500	693500
ad355764-3f62-466c-bec7-38eeddb50f52	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	50000	2025-12-04 08:48:37.761	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-041225-15:48:36 124838	ACB	{"id": 33859242, "code": null, "content": "PHAN CANH BAO DUY CHUYEN KHOAN-041225-15:48:36 124838", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-041225-15:48:36 124838", "transferType": "out", "accountNumber": "", "referenceCode": "4141", "transferAmount": 50000, "transactionDate": "2025-12-04 15:48:37"}	645500	695500
c520461d-3e5d-4f33-a4ba-55e0fb79690b	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	70000	2025-12-04 12:09:52.155	\N	INCOMING_TRANSFER	NGO THI MINH THANH CHUYEN KHOAN GD 5338NAMAA2LFGLNR 041225-19:09:50	SEPAY	{"content": "NGO THI MINH THANH CHUYEN KHOAN GD 5338NAMAA2LFGLNR 041225-19:09:50", "sepayId": 33888184, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NGO THI MINH THANH CHUYEN KHOAN GD 5338NAMAA2LFGLNR 041225-19:09:50", "referenceCode": "4142", "transactionDate": "2025-12-04 19:09:51"}	715500	645500
36daaa62-a3c1-470c-8c45-7b1b23b2d1e8	f4a6caca-67b8-4ae0-98db-32704a9c81fe	45f44477-beaf-41cb-9933-a14742b4e148	1000	2025-12-05 08:49:30.959	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí định kỳ - Hỗ trợ bệnh nhân - Bệnh viện A. Ngân sách: 17.000 VND, Chi phí thực tế: 16.000 VND. Request ID: 5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2	SURPLUS_TRANSFER	null	1000	0
c78eaed3-881a-43b4-b2dd-2530076cf75a	f4a6caca-67b8-4ae0-98db-32704a9c81fe	45f44477-beaf-41cb-9933-a14742b4e148	1000	2025-12-05 09:06:04.8	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí định kỳ - Hỗ trợ bệnh nhân - Bệnh viện A. Ngân sách: 17.000 VND, Chi phí thực tế: 16.000 VND. Request ID: 5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2	SURPLUS_TRANSFER	null	2000	1000
1c00799a-d332-47de-9f48-a9fbe57c9912	f4a6caca-67b8-4ae0-98db-32704a9c81fe	45f44477-beaf-41cb-9933-a14742b4e148	1000	2025-12-05 09:22:56.19	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí định kỳ - Hỗ trợ bệnh nhân - Bệnh viện A. Ngân sách: 17.000 VND, Chi phí thực tế: 16.000 VND. Request ID: 5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2	SURPLUS_TRANSFER	null	3000	2000
f0ec640b-840d-4279-a934-62afd08570bf	f4a6caca-67b8-4ae0-98db-32704a9c81fe	45f44477-beaf-41cb-9933-a14742b4e148	1000	2025-12-05 09:40:41.44	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí định kỳ - Hỗ trợ bệnh nhân - Bệnh viện A. Ngân sách: 17.000 VND, Chi phí thực tế: 16.000 VND. Request ID: 5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2	SURPLUS_TRANSFER	null	4000	3000
e95b2b96-fa48-4395-aa7f-8cfa36cf92e3	f4a6caca-67b8-4ae0-98db-32704a9c81fe	45f44477-beaf-41cb-9933-a14742b4e148	1000	2025-12-05 09:48:33.137	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí định kỳ - Hỗ trợ bệnh nhân - Bệnh viện A. Ngân sách: 17.000 VND, Chi phí thực tế: 16.000 VND. Request ID: 5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2	SURPLUS_TRANSFER	null	5000	4000
e0b1954f-7035-4650-8a25-7da7043875df	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	64000	2025-12-05 11:49:24.187	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109775214342 - 05122025 18:49:22 214342	ACB	{"id": 34039711, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109775214342 - 05122025 18:49:22 214342", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109775214342 - 05122025 18:49:22 214342", "transferType": "out", "accountNumber": "", "referenceCode": "4143", "transferAmount": 64000, "transactionDate": "2025-12-05 18:49:23"}	651500	715500
b17ac07f-9a29-4839-b7cf-1e81bcba8ec0	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	64000	2025-12-05 11:52:23.366	\N	INCOMING_TRANSFER	RUT TIEN TU VI MOMO 0938848615 CASHOUT 0938848615 109775289491 - 05122025 18:52:17 289491	SEPAY	{"content": "RUT TIEN TU VI MOMO 0938848615 CASHOUT 0938848615 109775289491 - 05122025 18:52:17 289491", "sepayId": 34040218, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify RUT TIEN TU VI MOMO 0938848615 CASHOUT 0938848615 109775289491 - 05122025 18:52:17 289491", "referenceCode": "4144", "transactionDate": "2025-12-05 18:52:18"}	715500	651500
0628e74d-f04a-49e8-b92c-e9006fb2747f	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	64000	2025-12-05 11:52:34.478	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109775633159 - 05122025 18:52:33 633159	ACB	{"id": 34040247, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109775633159 - 05122025 18:52:33 633159", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 109775633159 - 05122025 18:52:33 633159", "transferType": "out", "accountNumber": "", "referenceCode": "4145", "transferAmount": 64000, "transactionDate": "2025-12-05 18:52:33"}	651500	715500
f90cbe12-255a-4a18-b817-d99eabfb4837	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	120000	2025-12-06 04:35:04.293	\N	INCOMING_TRANSFER	MBVCB.12026205024.5340BFTVG2ZLXMIR.VO NGUYEN THUY LINH chuyen tien.CT tu 0881000458723 VO NGUYEN THUY LINH toi 27202407 PHAN CANH BAO DUY tai ACB GD 5340BFTVG2ZLXMIR 061225-11:35:02	SEPAY	{"content": "MBVCB.12026205024.5340BFTVG2ZLXMIR.VO NGUYEN THUY LINH chuyen tien.CT tu 0881000458723 VO NGUYEN THUY LINH toi 27202407 PHAN CANH BAO DUY tai ACB GD 5340BFTVG2ZLXMIR 061225-11:35:02", "sepayId": 34145674, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify MBVCB.12026205024.5340BFTVG2ZLXMIR.VO NGUYEN THUY LINH chuyen tien.CT tu 0881000458723 VO NGUYEN THUY LINH toi 27202407 PHAN CANH BAO DUY tai ACB GD 5340BFTVG2ZLXMIR 061225-11:35:02", "referenceCode": "4146", "transactionDate": "2025-12-06 11:35:03"}	771500	651500
f40e3c34-a783-4702-9672-e9d749b1352b	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	300000	2025-12-06 07:00:31.226	\N	INCOMING_TRANSFER	Tho chuyen tien banh bot loc chi Lieu 300k GD 5340VNIBJ2ATFZS9 061225-14:00:28	SEPAY	{"content": "Tho chuyen tien banh bot loc chi Lieu 300k GD 5340VNIBJ2ATFZS9 061225-14:00:28", "sepayId": 34167306, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify Tho chuyen tien banh bot loc chi Lieu 300k GD 5340VNIBJ2ATFZS9 061225-14:00:28", "referenceCode": "4147", "transactionDate": "2025-12-06 14:00:29"}	1071500	771500
a81c8b72-cd15-421b-ad4d-9f26bd5f30f5	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	100000	2025-12-06 07:23:09.845	\N	INCOMING_TRANSFER	MBVCB.12028249398.5340BFTVG2ZYAPUU.NGUYEN XUAN HOAI THUONG chuyen tien.CT tu 1032905438 NGUYEN XUAN HOAI THUONG toi 27202407 PHAN CANH BAO DUY tai ACB GD 5340BFTVG2ZYAPUU 061225-14:23:08	SEPAY	{"content": "MBVCB.12028249398.5340BFTVG2ZYAPUU.NGUYEN XUAN HOAI THUONG chuyen tien.CT tu 1032905438 NGUYEN XUAN HOAI THUONG toi 27202407 PHAN CANH BAO DUY tai ACB GD 5340BFTVG2ZYAPUU 061225-14:23:08", "sepayId": 34170288, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify MBVCB.12028249398.5340BFTVG2ZYAPUU.NGUYEN XUAN HOAI THUONG chuyen tien.CT tu 1032905438 NGUYEN XUAN HOAI THUONG toi 27202407 PHAN CANH BAO DUY tai ACB GD 5340BFTVG2ZYAPUU 061225-14:23:08", "referenceCode": "4148", "transactionDate": "2025-12-06 14:23:08"}	1171500	1071500
50d580bb-41ad-465d-8c61-0fc0e54ff86f	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	150000	2025-12-06 08:56:50.647	\N	INCOMING_TRANSFER	QR - LY MY PHUONG Chuyen tien GD 5340IBT1cWY59I43 061225-15:56:49	SEPAY	{"content": "QR - LY MY PHUONG Chuyen tien GD 5340IBT1cWY59I43 061225-15:56:49", "sepayId": 34182630, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify QR - LY MY PHUONG Chuyen tien GD 5340IBT1cWY59I43 061225-15:56:49", "referenceCode": "4149", "transactionDate": "2025-12-06 15:56:50"}	1321500	1171500
64319254-1fc1-4143-87eb-51d357249630	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	600000	2025-12-06 09:07:45.102	\N	INCOMING_TRANSFER	IBFT BUI THI XUAN LAN chuyen tien GD 5340IBT1hW2JUHBS 061225-16:07:43	SEPAY	{"content": "IBFT BUI THI XUAN LAN chuyen tien GD 5340IBT1hW2JUHBS 061225-16:07:43", "sepayId": 34184079, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify IBFT BUI THI XUAN LAN chuyen tien GD 5340IBT1hW2JUHBS 061225-16:07:43", "referenceCode": "4150", "transactionDate": "2025-12-06 16:07:44"}	1921500	1321500
0a105c2b-7ee6-4589-9db7-ecf7dd4d3d5a	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	35000	2025-12-06 11:04:55.829	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-061225-18:04:53 553932	ACB	{"id": 34203640, "code": null, "content": "PHAN CANH BAO DUY CHUYEN KHOAN-061225-18:04:53 553932", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-061225-18:04:53 553932", "transferType": "out", "accountNumber": "", "referenceCode": "4151", "transferAmount": 35000, "transactionDate": "2025-12-06 18:04:54"}	1886500	1921500
373fb56a-5c80-47d0-b7c2-f310a5afbaf8	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	66000	2025-12-06 11:16:14.373	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-061225-18:16:12 578778	ACB	{"id": 34205412, "code": null, "content": "PHAN CANH BAO DUY CHUYEN KHOAN-061225-18:16:12 578778", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-061225-18:16:12 578778", "transferType": "out", "accountNumber": "", "referenceCode": "4152", "transferAmount": 66000, "transactionDate": "2025-12-06 18:16:13"}	1820500	1886500
c665cc46-ef40-456e-a0b9-5ac0759e1369	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	120000	2025-12-06 11:39:10.37	\N	INCOMING_TRANSFER	TRAN NGOC THAO NHI chuyen tien FT25340767240040 GD 5340IBT1kJL9NUFN 061225-18:39:08	SEPAY	{"content": "TRAN NGOC THAO NHI chuyen tien FT25340767240040 GD 5340IBT1kJL9NUFN 061225-18:39:08", "sepayId": 34209089, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify TRAN NGOC THAO NHI chuyen tien FT25340767240040 GD 5340IBT1kJL9NUFN 061225-18:39:08", "referenceCode": "4153", "transactionDate": "2025-12-06 18:39:09"}	1940500	1820500
ec27bcc9-a8e7-493c-9d4e-af973715ebd5	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	240000	2025-12-06 13:19:33.828	\N	INCOMING_TRANSFER	NGUYEN THUY DIEN chuyen tien qua MoMo GD 5340IBT1hW21YQ1C 061225-20:19:32	SEPAY	{"content": "NGUYEN THUY DIEN chuyen tien qua MoMo GD 5340IBT1hW21YQ1C 061225-20:19:32", "sepayId": 34226774, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NGUYEN THUY DIEN chuyen tien qua MoMo GD 5340IBT1hW21YQ1C 061225-20:19:32", "referenceCode": "4154", "transactionDate": "2025-12-06 20:19:32"}	2180500	1940500
cd2dc3f0-835f-4aa6-a54a-da5de8b61e41	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	100000	2025-12-06 13:33:30.571	\N	INCOMING_TRANSFER	Lam Thi Vien Phuong chuyen tien QR GD 5340IBT1iWLELRD3 061225-20:33:28	SEPAY	{"content": "Lam Thi Vien Phuong chuyen tien QR GD 5340IBT1iWLELRD3 061225-20:33:28", "sepayId": 34230099, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify Lam Thi Vien Phuong chuyen tien QR GD 5340IBT1iWLELRD3 061225-20:33:28", "referenceCode": "4155", "transactionDate": "2025-12-06 20:33:29"}	2280500	2180500
9f8fda2b-3511-4288-adcf-65128c84340d	f4a6caca-67b8-4ae0-98db-32704a9c81fe	431119ca-66b6-4ade-bbe1-b06a52016fa8	5000	2025-12-07 02:26:09.612	\N	WITHDRAWAL	Tự động chuyển tiền vào chiến dịch "Chương trình Suất ăn miễn phí cho Đình Luyện" khi được phê duyệt	\N	{}	0	5000
35a9f8c3-0783-43c8-91a7-dbcc94b8a393	f4a6caca-67b8-4ae0-98db-32704a9c81fe	431119ca-66b6-4ade-bbe1-b06a52016fa8	4000	2025-12-07 08:24:24.689	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí cho Đình Luyện - Công viên B5. Ngân sách: 14.000 VND, Chi phí thực tế: 10.000 VND. Request ID: c720cc2e-3617-49b2-b451-714a3b13a86e	SURPLUS_TRANSFER	null	4000	0
1f7042ee-746d-4a1c-96eb-ccc803f984fd	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	66000	2025-12-07 09:01:49.91	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110000536629 - 07122025 16:01:47 536629	ACB	{"id": 34344511, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110000536629 - 07122025 16:01:47 536629", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110000536629 - 07122025 16:01:47 536629", "transferType": "out", "accountNumber": "", "referenceCode": "4157", "transferAmount": 66000, "transactionDate": "2025-12-07 16:01:48"}	2214500	2280500
a0f557a1-b967-40a6-8de3-eaa592d72f4b	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	30000	2025-12-07 09:26:46.107	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110003052465 - 07122025 16:26:45 052465	ACB	{"id": 34348269, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110003052465 - 07122025 16:26:45 052465", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110003052465 - 07122025 16:26:45 052465", "transferType": "out", "accountNumber": "", "referenceCode": "4158", "transferAmount": 30000, "transactionDate": "2025-12-07 16:26:45"}	2184500	2214500
6c774344-b8f1-4307-a08d-d0f148e47d43	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	200000	2025-12-07 09:41:34.578	\N	INCOMING_TRANSFER	IB NGUYEN THI NGOC NHUNG CHUYEN KHOAN	SEPAY	{"content": "IB NGUYEN THI NGOC NHUNG CHUYEN KHOAN", "sepayId": 34350609, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify IB NGUYEN THI NGOC NHUNG CHUYEN KHOAN", "referenceCode": "4159", "transactionDate": "2025-12-07 16:41:33"}	2384500	2184500
47e55a80-02ab-434f-a197-e95cfbbc2eff	f4a6caca-67b8-4ae0-98db-32704a9c81fe	431119ca-66b6-4ade-bbe1-b06a52016fa8	4000	2025-12-07 10:12:32.175	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí cho Đình Luyện - Công viên B5. Ngân sách: 14.000 VND, Chi phí thực tế: 10.000 VND. Request ID: c720cc2e-3617-49b2-b451-714a3b13a86e	SURPLUS_TRANSFER	null	8000	4000
6172d8a8-9fe3-48ff-9339-c48593a8c825	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	230000	2025-12-07 11:20:31.31	\N	INCOMING_TRANSFER	MAI THI VAN chuyen tien FT25342400536616 GD 5341IBT1kJL51TP7 071225-18:20:27	SEPAY	{"content": "MAI THI VAN chuyen tien FT25342400536616 GD 5341IBT1kJL51TP7 071225-18:20:27", "sepayId": 34365772, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify MAI THI VAN chuyen tien FT25342400536616 GD 5341IBT1kJL51TP7 071225-18:20:27", "referenceCode": "4160", "transactionDate": "2025-12-07 18:20:30"}	2614500	2384500
3c202276-e24d-4042-aecd-145da703b98e	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	70000	2025-12-07 11:55:36.925	\N	INCOMING_TRANSFER	LAM NGUYEN Y DUYEN chuyen tien qua MoMo GD 5341IBT1hW295T5C 071225-18:55:35	SEPAY	{"content": "LAM NGUYEN Y DUYEN chuyen tien qua MoMo GD 5341IBT1hW295T5C 071225-18:55:35", "sepayId": 34371334, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify LAM NGUYEN Y DUYEN chuyen tien qua MoMo GD 5341IBT1hW295T5C 071225-18:55:35", "referenceCode": "4161", "transactionDate": "2025-12-07 18:55:35"}	2684500	2614500
eb4a28b4-2e76-4af4-9efe-feac90b019ee	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	500000	2025-12-07 14:00:28.339	\N	INCOMING_TRANSFER	MBVCB.12047629686.5341BFTVG2Z1VEBZ.DONG MAY HONG TUYEN chuyen tien.CT tu 0421000510053 DONG MAY HONG TUYEN toi 27202407 PHAN CANH BAO DUY tai ACB GD 5341BFTVG2Z1VEBZ 071225-21:00:25	SEPAY	{"content": "MBVCB.12047629686.5341BFTVG2Z1VEBZ.DONG MAY HONG TUYEN chuyen tien.CT tu 0421000510053 DONG MAY HONG TUYEN toi 27202407 PHAN CANH BAO DUY tai ACB GD 5341BFTVG2Z1VEBZ 071225-21:00:25", "sepayId": 34392125, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify MBVCB.12047629686.5341BFTVG2Z1VEBZ.DONG MAY HONG TUYEN chuyen tien.CT tu 0421000510053 DONG MAY HONG TUYEN toi 27202407 PHAN CANH BAO DUY tai ACB GD 5341BFTVG2Z1VEBZ 071225-21:00:25", "referenceCode": "4162", "transactionDate": "2025-12-07 21:00:26"}	3184500	2684500
ae512ce9-c1f8-46d3-bd36-0c34f1a6ecfe	f4a6caca-67b8-4ae0-98db-32704a9c81fe	431119ca-66b6-4ade-bbe1-b06a52016fa8	4000	2025-12-08 04:22:07.667	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí cho Đình Luyện - Công viên B5. Ngân sách: 14.000 VND, Chi phí thực tế: 10.000 VND. Request ID: c720cc2e-3617-49b2-b451-714a3b13a86e	SURPLUS_TRANSFER	null	12000	8000
53b4dea2-3978-4740-8f84-881bdcb1271c	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	160000	2025-12-08 11:04:25.541	\N	INCOMING_TRANSFER	MBVCB.12058538219.5342BFTVG2Z81NLC.VU NGOC TRAM chuyen tien.CT tu 0371000468999 VU NGOC TRAM toi 27202407 PHAN CANH BAO DUY tai ACB GD 5342BFTVG2Z81NLC 081225-18:04:23	SEPAY	{"content": "MBVCB.12058538219.5342BFTVG2Z81NLC.VU NGOC TRAM chuyen tien.CT tu 0371000468999 VU NGOC TRAM toi 27202407 PHAN CANH BAO DUY tai ACB GD 5342BFTVG2Z81NLC 081225-18:04:23", "sepayId": 34521195, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify MBVCB.12058538219.5342BFTVG2Z81NLC.VU NGOC TRAM chuyen tien.CT tu 0371000468999 VU NGOC TRAM toi 27202407 PHAN CANH BAO DUY tai ACB GD 5342BFTVG2Z81NLC 081225-18:04:23", "referenceCode": "4163", "transactionDate": "2025-12-08 18:04:24"}	3344500	3184500
6f8e175b-3626-4fd4-8846-09ed67ed6b69	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	100000	2025-12-09 03:50:43.132	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110203461905 - 09122025 10:50:41 461905	ACB	{"id": 34614402, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110203461905 - 09122025 10:50:41 461905", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110203461905 - 09122025 10:50:41 461905", "transferType": "out", "accountNumber": "", "referenceCode": "4164", "transferAmount": 100000, "transactionDate": "2025-12-09 10:50:42"}	3244500	3344500
a68f85dd-374e-4d1f-acff-7a71a024d405	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	156000	2025-12-09 05:25:12.747	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-091225-12:25:11 715140	ACB	{"id": 34627999, "code": null, "content": "PHAN CANH BAO DUY CHUYEN KHOAN-091225-12:25:11 715140", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN CANH BAO DUY CHUYEN KHOAN-091225-12:25:11 715140", "transferType": "out", "accountNumber": "", "referenceCode": "4165", "transferAmount": 156000, "transactionDate": "2025-12-09 12:25:11"}	3088500	3244500
a9892a8f-65a7-42e6-bd06-0dbb406bb3dd	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	280000	2025-12-09 06:08:39.296	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify THANH TOAN CHO CGV Su Van Hanh - 091225 13:08:38 20745628	ACB	{"id": 34633551, "code": null, "content": "THANH TOAN CHO CGV Su Van Hanh - 091225 13:08:38 20745628", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify THANH TOAN CHO CGV Su Van Hanh - 091225 13:08:38 20745628", "transferType": "out", "accountNumber": "", "referenceCode": "4166", "transferAmount": 280000, "transactionDate": "2025-12-09 13:08:38"}	2808500	3088500
fca99aaa-a1a5-440c-bfcd-35684ac3d173	f4a6caca-67b8-4ae0-98db-32704a9c81fe	431119ca-66b6-4ade-bbe1-b06a52016fa8	4000	2025-12-09 06:09:19.709	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Chương trình Suất ăn miễn phí cho Đình Luyện - Công viên B5. Ngân sách: 14.000 VND, Chi phí thực tế: 10.000 VND. Request ID: c720cc2e-3617-49b2-b451-714a3b13a86e	SURPLUS_TRANSFER	null	16000	12000
9b446552-0e4c-4ce7-aab9-044b23db3a09	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	218000	2025-12-09 06:15:14.622	\N	INCOMING_TRANSFER	VU HONG ANH DUONG chuyen tien GD 5343IBT1dJ4224JP 091225-13:15:12	SEPAY	{"content": "VU HONG ANH DUONG chuyen tien GD 5343IBT1dJ4224JP 091225-13:15:12", "sepayId": 34634276, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify VU HONG ANH DUONG chuyen tien GD 5343IBT1dJ4224JP 091225-13:15:12", "referenceCode": "4167", "transactionDate": "2025-12-09 13:15:13"}	3026500	2808500
e3aa6412-7c4d-430d-80c0-8a1da780af75	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	150000	2025-12-09 08:22:22.222	\N	INCOMING_TRANSFER	PHAN DO MINH HOANG chuyen tien qua MoMo GD 5343IBT1hW28EGFH 091225-15:22:21	SEPAY	{"content": "PHAN DO MINH HOANG chuyen tien qua MoMo GD 5343IBT1hW28EGFH 091225-15:22:21", "sepayId": 34650721, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN DO MINH HOANG chuyen tien qua MoMo GD 5343IBT1hW28EGFH 091225-15:22:21", "referenceCode": "4168", "transactionDate": "2025-12-09 15:22:21"}	3176500	3026500
2261ad24-0331-4043-a33d-e4bf64ba7bd5	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	170000	2025-12-09 08:54:26.041	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110235058345 - 09122025 15:54:24 058345	ACB	{"id": 34655124, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110235058345 - 09122025 15:54:24 058345", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110235058345 - 09122025 15:54:24 058345", "transferType": "out", "accountNumber": "", "referenceCode": "4169", "transferAmount": 170000, "transactionDate": "2025-12-09 15:54:25"}	3006500	3176500
16f3f542-8aed-430f-82a0-8d02d092b314	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	269000	2025-12-09 09:19:24.4	\N	WITHDRAWAL	Chuyển khoản ra tài khoản ngân hàng - BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110237519425 - 09122025 16:19:23 519425	ACB	{"id": 34658723, "code": null, "content": "NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110237519425 - 09122025 16:19:23 519425", "gateway": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NAP TIEN VAO VI MOMO 0938848615 CASHIN 0938848615 110237519425 - 09122025 16:19:23 519425", "transferType": "out", "accountNumber": "", "referenceCode": "4170", "transferAmount": 269000, "transactionDate": "2025-12-09 16:19:23"}	2737500	3006500
d154757a-5ae3-40f0-ac2d-05073c62e39a	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	90000	2025-12-09 10:45:36.422	\N	INCOMING_TRANSFER	110248145980 PHAN DO MINH HOANG chuyen tien qua MoMo CHUYEN TIEN OQCH0004YL1a MOMO110248145980MOMO GD 5343IBT1dJ4S6T1Y 091225-17:45:33	SEPAY	{"content": "110248145980 PHAN DO MINH HOANG chuyen tien qua MoMo CHUYEN TIEN OQCH0004YL1a MOMO110248145980MOMO GD 5343IBT1dJ4S6T1Y 091225-17:45:33", "sepayId": 34673328, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify 110248145980 PHAN DO MINH HOANG chuyen tien qua MoMo CHUYEN TIEN OQCH0004YL1a MOMO110248145980MOMO GD 5343IBT1dJ4S6T1Y 091225-17:45:33", "referenceCode": "4171", "transactionDate": "2025-12-09 17:45:34"}	2827500	2737500
a2ca9db6-e6c5-4fab-9aaa-62f5ae8d846d	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	70000	2025-12-09 13:24:23.662	\N	INCOMING_TRANSFER	PHAN LE VANG ANH Chuyen tien GD 5343BIDVE2BFRLKB 091225-20:24:21	SEPAY	{"content": "PHAN LE VANG ANH Chuyen tien GD 5343BIDVE2BFRLKB 091225-20:24:21", "sepayId": 34701413, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify PHAN LE VANG ANH Chuyen tien GD 5343BIDVE2BFRLKB 091225-20:24:21", "referenceCode": "4172", "transactionDate": "2025-12-09 20:24:22"}	2897500	2827500
5a20e590-6d20-48db-8bdf-5671c02d154d	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	\N	90000	2025-12-09 14:13:39.224	\N	INCOMING_TRANSFER	NGUYEN KIM KHANH chuyen tien FT25344311572947 GD 5343IBT1kJT143X1 091225-21:13:36	SEPAY	{"content": "NGUYEN KIM KHANH chuyen tien FT25344311572947 GD 5343IBT1kJT143X1 091225-21:13:36", "sepayId": 34710804, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify NGUYEN KIM KHANH chuyen tien FT25344311572947 GD 5343IBT1kJT143X1 091225-21:13:36", "referenceCode": "4173", "transactionDate": "2025-12-09 21:13:38"}	2987500	2897500
1aa34a8c-405d-40ee-8981-0ca7d9abf47d	f4a6caca-67b8-4ae0-98db-32704a9c81fe	f9bd788e-1594-48e2-8c0a-e0f16ddb909a	16000	2025-12-09 14:58:58.586	\N	WITHDRAWAL	Tự động chuyển tiền vào chiến dịch "Góp Gạo Nuôi Bé" khi được phê duyệt	\N	{}	0	16000
6b4a0f96-92b3-444f-8942-7d8bfed94c91	f4a6caca-67b8-4ae0-98db-32704a9c81fe	f9bd788e-1594-48e2-8c0a-e0f16ddb909a	300	2025-12-09 15:20:58.3	\N	INCOMING_TRANSFER	Tiền dư từ yêu cầu nguyên liệu: Góp Gạo Nuôi Bé - Khu ổ chuột A. Ngân sách: 12.800 VND, Chi phí thực tế: 12.500 VND. Request ID: 8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	SURPLUS_TRANSFER	null	300	0
8e894a47-5739-4793-b86c-7ea9215f478a	95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	84a8f4d0-127d-4283-adaa-0b6a65af65e0	2000	2025-12-10 07:29:10.241	4fc1862e-6c9c-4727-a811-ffe9fa548878	INCOMING_TRANSFER	CSEN359VKN0 1765351684732110	\N	null	2989500	2987500
\.


--
-- TOC entry 4577 (class 0 OID 31591)
-- Dependencies: 227
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.wallets (id, user_id, balance, created_at, updated_at, wallet_type) FROM stdin;
154cc209-00c0-4cf0-aefc-d4a4be7874dd	019a481a-612a-74e1-aa1d-764e11f0c593	20000	2025-11-20 07:02:36.006	2025-12-04 05:30:18.608	FUNDRAISER
f53901e0-e236-440d-85e6-f56347b0542e	019ae801-6412-707f-aefb-014cccb869ba	0	2025-12-04 06:26:52.328	2025-12-04 06:26:52.328	FUNDRAISER
f4a6caca-67b8-4ae0-98db-32704a9c81fe	019a7200-0e85-702c-9a94-34214d36cac1	300	2025-11-11 10:30:39.064	2025-12-09 15:20:58.307	FUNDRAISER
95b26b7b-d4c4-458b-b1bb-58e60c04e4ad	01997eeb-6f67-7a46-87e2-e44f0a51ebe0	2989500	2025-11-08 17:32:37.202	2025-12-10 07:29:10.251	ADMIN
50c2d375-4543-4bb5-84d2-d83ece3505f1	019ae7af-3186-734c-9b24-fe5ce8819e4f	0	2025-12-05 14:41:10.267	2025-12-05 14:41:10.267	FUNDRAISER
b72d7f6a-f2e3-4edb-9168-ffcd85c48601	019a9c36-cd29-734b-ade1-d6e7704c7752	0	2025-12-02 13:10:04.393	2025-12-02 13:10:04.393	FUNDRAISER
181203df-e549-4af4-8439-f8358a49b8b0	019ac55c-0903-7685-b3cf-abee461fcd6b	0	2025-11-27 13:01:54.625	2025-11-28 15:06:50.789	FUNDRAISER
6048fa13-1fa9-4b98-bc66-382c1af06ef5	0199e599-5573-754a-9572-fdf8e68ae301	0	2025-11-08 17:32:16.548	2025-11-28 15:13:31.404	FUNDRAISER
62041d6b-d1c0-4211-b28c-458f3f8a4575	019ae433-cd43-7666-b43b-83ebf01deeee	0	2025-12-03 12:50:38.991	2025-12-03 12:50:38.991	FUNDRAISER
9f450c73-5afd-4d35-8b10-931e24059f35	0199dec4-4e5c-73fe-a51c-680b7450c3f3	0	2025-12-03 13:01:59.648	2025-12-03 13:01:59.648	FUNDRAISER
8af011db-3e22-4be2-b810-b18de9ba6df7	019ae471-5143-775e-a294-f2c480fc354b	0	2025-12-03 14:04:10.513	2025-12-03 14:04:10.513	FUNDRAISER
\.


--
-- TOC entry 4382 (class 2606 OID 16477)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4389 (class 2606 OID 18085)
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- TOC entry 4396 (class 2606 OID 18865)
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4394 (class 2606 OID 18856)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4413 (class 2606 OID 87146)
-- Name: system_configs system_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_pkey PRIMARY KEY (key);


--
-- TOC entry 4391 (class 2606 OID 18093)
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- TOC entry 4386 (class 2606 OID 16512)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4408 (class 2606 OID 31607)
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4398 (class 2606 OID 31599)
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- TOC entry 4392 (class 1259 OID 18094)
-- Name: user_badges_user_id_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX user_badges_user_id_key ON public.user_badges USING btree (user_id);


--
-- TOC entry 4383 (class 1259 OID 17191)
-- Name: users_cognito_id_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX users_cognito_id_key ON public.users USING btree (cognito_id);


--
-- TOC entry 4384 (class 1259 OID 16552)
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- TOC entry 4387 (class 1259 OID 22228)
-- Name: users_user_name_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX users_user_name_key ON public.users USING btree (user_name);


--
-- TOC entry 4402 (class 1259 OID 33587)
-- Name: wallet_transactions_campaign_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_campaign_id_created_at_idx ON public.wallet_transactions USING btree (campaign_id, created_at);


--
-- TOC entry 4403 (class 1259 OID 42453)
-- Name: wallet_transactions_campaign_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_campaign_id_idx ON public.wallet_transactions USING btree (campaign_id);


--
-- TOC entry 4404 (class 1259 OID 42454)
-- Name: wallet_transactions_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_created_at_idx ON public.wallet_transactions USING btree (created_at);


--
-- TOC entry 4405 (class 1259 OID 33588)
-- Name: wallet_transactions_gateway_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_gateway_idx ON public.wallet_transactions USING btree (gateway);


--
-- TOC entry 4406 (class 1259 OID 33584)
-- Name: wallet_transactions_payment_transaction_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_payment_transaction_id_idx ON public.wallet_transactions USING btree (payment_transaction_id);


--
-- TOC entry 4409 (class 1259 OID 69059)
-- Name: wallet_transactions_transaction_type_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_transaction_type_idx ON public.wallet_transactions USING btree (transaction_type);


--
-- TOC entry 4410 (class 1259 OID 42452)
-- Name: wallet_transactions_wallet_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_wallet_id_idx ON public.wallet_transactions USING btree (wallet_id);


--
-- TOC entry 4411 (class 1259 OID 69060)
-- Name: wallet_transactions_wallet_id_transaction_type_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallet_transactions_wallet_id_transaction_type_idx ON public.wallet_transactions USING btree (wallet_id, transaction_type);


--
-- TOC entry 4399 (class 1259 OID 31608)
-- Name: wallets_user_id_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX wallets_user_id_key ON public.wallets USING btree (user_id);


--
-- TOC entry 4400 (class 1259 OID 33581)
-- Name: wallets_user_id_wallet_type_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallets_user_id_wallet_type_idx ON public.wallets USING btree (user_id, wallet_type);


--
-- TOC entry 4401 (class 1259 OID 33580)
-- Name: wallets_wallet_type_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX wallets_wallet_type_idx ON public.wallets USING btree (wallet_type);


--
-- TOC entry 4417 (class 2606 OID 18878)
-- Name: organization_members organization_members_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4418 (class 2606 OID 18873)
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4416 (class 2606 OID 18868)
-- Name: organizations organizations_representative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_representative_id_fkey FOREIGN KEY (representative_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4414 (class 2606 OID 18101)
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4415 (class 2606 OID 18096)
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4420 (class 2606 OID 31615)
-- Name: wallet_transactions wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4419 (class 2606 OID 31610)
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4586 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO cdc_user;


--
-- TOC entry 4587 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE _prisma_migrations; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public._prisma_migrations TO cdc_user;


--
-- TOC entry 4588 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE badges; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.badges TO cdc_user;


--
-- TOC entry 4589 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE organization_members; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.organization_members TO cdc_user;


--
-- TOC entry 4590 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.organizations TO cdc_user;


--
-- TOC entry 4591 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE system_configs; Type: ACL; Schema: public; Owner: doadmin
--

GRANT SELECT ON TABLE public.system_configs TO cdc_user;


--
-- TOC entry 4592 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE user_badges; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.user_badges TO cdc_user;


--
-- TOC entry 4593 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE users; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.users TO cdc_user;


--
-- TOC entry 4594 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE wallet_transactions; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.wallet_transactions TO cdc_user;


--
-- TOC entry 4595 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE wallets; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.wallets TO cdc_user;


--
-- TOC entry 2129 (class 826 OID 81584)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: doadmin
--

ALTER DEFAULT PRIVILEGES FOR ROLE doadmin IN SCHEMA public GRANT SELECT ON TABLES TO cdc_user;


-- Completed on 2025-12-11 10:17:09

--
-- PostgreSQL database dump complete
--

