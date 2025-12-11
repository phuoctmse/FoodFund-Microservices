--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.4

-- Started on 2025-12-11 10:14:56

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
-- TOC entry 7 (class 2615 OID 21548)
-- Name: public; Type: SCHEMA; Schema: -; Owner: doadmin
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO doadmin;

--
-- TOC entry 974 (class 1247 OID 89979)
-- Name: Campaign_Phase_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Campaign_Phase_Status" AS ENUM (
    'PLANNING',
    'AWAITING_INGREDIENT_DISBURSEMENT',
    'INGREDIENT_PURCHASE',
    'AWAITING_COOKING_DISBURSEMENT',
    'COOKING',
    'AWAITING_DELIVERY_DISBURSEMENT',
    'DELIVERY',
    'COMPLETED',
    'CANCELLED',
    'FAILED'
);


ALTER TYPE public."Campaign_Phase_Status" OWNER TO doadmin;

--
-- TOC entry 923 (class 1247 OID 29596)
-- Name: Campaign_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Campaign_Status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ACTIVE',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'ENDED'
);


ALTER TYPE public."Campaign_Status" OWNER TO doadmin;

--
-- TOC entry 935 (class 1247 OID 61650)
-- Name: Entity_Type; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Entity_Type" AS ENUM (
    'CAMPAIGN',
    'POST',
    'COMMENT',
    'DONATION',
    'INGREDIENT_REQUEST',
    'DELIVERY_TASK',
    'WALLET',
    'SYSTEM'
);


ALTER TYPE public."Entity_Type" OWNER TO doadmin;

--
-- TOC entry 932 (class 1247 OID 61625)
-- Name: Notification_Type; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Notification_Type" AS ENUM (
    'CAMPAIGN_APPROVED',
    'CAMPAIGN_REJECTED',
    'CAMPAIGN_COMPLETED',
    'CAMPAIGN_CANCELLED',
    'CAMPAIGN_DONATION_RECEIVED',
    'CAMPAIGN_NEW_POST',
    'POST_LIKE',
    'POST_COMMENT',
    'POST_REPLY',
    'INGREDIENT_REQUEST_APPROVED',
    'DELIVERY_TASK_ASSIGNED',
    'SYSTEM_ANNOUNCEMENT',
    'SURPLUS_TRANSFERRED'
);


ALTER TYPE public."Notification_Type" OWNER TO doadmin;

--
-- TOC entry 962 (class 1247 OID 80541)
-- Name: OutboxStatus; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."OutboxStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE public."OutboxStatus" OWNER TO doadmin;

--
-- TOC entry 929 (class 1247 OID 38004)
-- Name: Payment_Amount_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Payment_Amount_Status" AS ENUM (
    'PENDING',
    'PARTIAL',
    'COMPLETED',
    'OVERPAID'
);


ALTER TYPE public."Payment_Amount_Status" OWNER TO doadmin;

--
-- TOC entry 950 (class 1247 OID 75279)
-- Name: Reassignment_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Reassignment_Status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."Reassignment_Status" OWNER TO doadmin;

--
-- TOC entry 917 (class 1247 OID 21755)
-- Name: Transaction_Status; Type: TYPE; Schema: public; Owner: doadmin
--

CREATE TYPE public."Transaction_Status" AS ENUM (
    'SUCCESS',
    'FAILED',
    'REFUNDED',
    'PENDING'
);


ALTER TYPE public."Transaction_Status" OWNER TO doadmin;

--
-- TOC entry 253 (class 1255 OID 75330)
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

--
-- TOC entry 252 (class 1255 OID 61717)
-- Name: create_notification_partition(); Type: FUNCTION; Schema: public; Owner: doadmin
--

CREATE FUNCTION public.create_notification_partition() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := 'notifications_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
    end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF notifications FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$;


ALTER FUNCTION public.create_notification_partition() OWNER TO doadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 21549)
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
-- TOC entry 224 (class 1259 OID 21605)
-- Name: campaign_categories; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.campaign_categories (
    id text NOT NULL,
    title character varying(100) NOT NULL,
    description text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.campaign_categories OWNER TO doadmin;

--
-- TOC entry 229 (class 1259 OID 29631)
-- Name: campaign_phases; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.campaign_phases (
    id text NOT NULL,
    campaign_id text NOT NULL,
    phase_name character varying(100) NOT NULL,
    location text NOT NULL,
    ingredient_purchase_date timestamp(3) without time zone NOT NULL,
    cooking_date timestamp(3) without time zone NOT NULL,
    delivery_date timestamp(3) without time zone NOT NULL,
    status public."Campaign_Phase_Status" DEFAULT 'PLANNING'::public."Campaign_Phase_Status" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    ingredient_budget_percentage numeric(5,2) NOT NULL,
    cooking_budget_percentage numeric(5,2) NOT NULL,
    delivery_budget_percentage numeric(5,2) NOT NULL
);


ALTER TABLE public.campaign_phases OWNER TO doadmin;

--
-- TOC entry 234 (class 1259 OID 75289)
-- Name: campaign_reassignments; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.campaign_reassignments (
    id text NOT NULL,
    campaign_id text NOT NULL,
    organization_id text NOT NULL,
    status public."Reassignment_Status" DEFAULT 'PENDING'::public."Reassignment_Status" NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    responded_at timestamp(3) without time zone,
    response_note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.campaign_reassignments OWNER TO doadmin;

--
-- TOC entry 222 (class 1259 OID 21571)
-- Name: campaigns; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.campaigns (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    cover_image text NOT NULL,
    target_amount bigint DEFAULT 0 NOT NULL,
    received_amount bigint DEFAULT 0 NOT NULL,
    status public."Campaign_Status" DEFAULT 'PENDING'::public."Campaign_Status" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    cover_image_file_key text,
    category_id text,
    completed_at timestamp(3) without time zone,
    fundraising_end_date timestamp(3) without time zone NOT NULL,
    fundraising_start_date timestamp(3) without time zone NOT NULL,
    changed_status_at timestamp(3) without time zone,
    extension_count integer DEFAULT 0 NOT NULL,
    extension_days integer DEFAULT 0 NOT NULL,
    donation_count integer DEFAULT 0 NOT NULL,
    reason text,
    organization_id text,
    cancelled_at timestamp(3) without time zone,
    previous_status public."Campaign_Status",
    slug text
);


ALTER TABLE public.campaigns OWNER TO doadmin;

--
-- TOC entry 223 (class 1259 OID 21584)
-- Name: donations; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.donations (
    id text NOT NULL,
    donor_id text NOT NULL,
    campaign_id text NOT NULL,
    amount bigint DEFAULT 0 NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    donor_name text
);


ALTER TABLE public.donations OWNER TO doadmin;

--
-- TOC entry 230 (class 1259 OID 61663)
-- Name: notifications; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    actor_id text,
    type public."Notification_Type" NOT NULL,
    entity_type public."Entity_Type" NOT NULL,
    entity_id text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
)
PARTITION BY RANGE (created_at);


ALTER TABLE public.notifications OWNER TO doadmin;

--
-- TOC entry 231 (class 1259 OID 61675)
-- Name: notifications_2025_11; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.notifications_2025_11 (
    id text NOT NULL,
    user_id text NOT NULL,
    actor_id text,
    type public."Notification_Type" NOT NULL,
    entity_type public."Entity_Type" NOT NULL,
    entity_id text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications_2025_11 OWNER TO doadmin;

--
-- TOC entry 232 (class 1259 OID 61689)
-- Name: notifications_2025_12; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.notifications_2025_12 (
    id text NOT NULL,
    user_id text NOT NULL,
    actor_id text,
    type public."Notification_Type" NOT NULL,
    entity_type public."Entity_Type" NOT NULL,
    entity_id text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications_2025_12 OWNER TO doadmin;

--
-- TOC entry 233 (class 1259 OID 61703)
-- Name: notifications_2026_01; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.notifications_2026_01 (
    id text NOT NULL,
    user_id text NOT NULL,
    actor_id text,
    type public."Notification_Type" NOT NULL,
    entity_type public."Entity_Type" NOT NULL,
    entity_id text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications_2026_01 OWNER TO doadmin;

--
-- TOC entry 238 (class 1259 OID 80549)
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.outbox_events (
    id text NOT NULL,
    aggregate_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status public."OutboxStatus" DEFAULT 'PENDING'::public."OutboxStatus" NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp(3) without time zone,
    error_log text
);


ALTER TABLE public.outbox_events OWNER TO doadmin;

--
-- TOC entry 225 (class 1259 OID 21771)
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.payment_transactions (
    id text NOT NULL,
    donation_id text NOT NULL,
    currency character varying(10) DEFAULT 'VND'::character varying NOT NULL,
    status public."Transaction_Status" DEFAULT 'PENDING'::public."Transaction_Status" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    refunded_at timestamp(3) without time zone,
    error_code character varying(50),
    error_description text,
    order_code bigint,
    amount bigint DEFAULT 0 NOT NULL,
    description text,
    gateway character varying(50),
    processed_by_webhook boolean DEFAULT false NOT NULL,
    received_amount bigint DEFAULT 0 NOT NULL,
    payment_status public."Payment_Amount_Status" DEFAULT 'PENDING'::public."Payment_Amount_Status" NOT NULL,
    payos_metadata jsonb,
    sepay_metadata jsonb
);


ALTER TABLE public.payment_transactions OWNER TO doadmin;

--
-- TOC entry 240 (class 1259 OID 84100)
-- Name: planned_ingredients; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.planned_ingredients (
    id text NOT NULL,
    campaign_phase_id text NOT NULL,
    name character varying(100) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit character varying(50) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.planned_ingredients OWNER TO doadmin;

--
-- TOC entry 239 (class 1259 OID 84091)
-- Name: planned_meals; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.planned_meals (
    id text NOT NULL,
    campaign_phase_id text NOT NULL,
    name character varying(200) NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.planned_meals OWNER TO doadmin;

--
-- TOC entry 228 (class 1259 OID 21799)
-- Name: post_comments; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.post_comments (
    id text NOT NULL,
    post_id text NOT NULL,
    user_id text NOT NULL,
    content text NOT NULL,
    parent_comment_id text,
    comment_path text,
    depth integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.post_comments OWNER TO doadmin;

--
-- TOC entry 227 (class 1259 OID 21791)
-- Name: post_likes; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.post_likes (
    id text NOT NULL,
    post_id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.post_likes OWNER TO doadmin;

--
-- TOC entry 226 (class 1259 OID 21780)
-- Name: posts; Type: TABLE; Schema: public; Owner: doadmin
--

CREATE TABLE public.posts (
    id text NOT NULL,
    campaign_id text NOT NULL,
    created_by text NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    media jsonb,
    like_count integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.posts OWNER TO doadmin;

--
-- TOC entry 4402 (class 0 OID 0)
-- Name: notifications_2025_11; Type: TABLE ATTACH; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications ATTACH PARTITION public.notifications_2025_11 FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');


--
-- TOC entry 4403 (class 0 OID 0)
-- Name: notifications_2025_12; Type: TABLE ATTACH; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications ATTACH PARTITION public.notifications_2025_12 FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');


--
-- TOC entry 4404 (class 0 OID 0)
-- Name: notifications_2026_01; Type: TABLE ATTACH; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications ATTACH PARTITION public.notifications_2026_01 FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');


--
-- TOC entry 4788 (class 0 OID 21549)
-- Dependencies: 221
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
dc1b51c7-92d8-4e37-881b-0e9f98aaf26d	a5c21b48fd3709dc6b057722fae2ffaed5f2e85466adfc7586bbfb53ddeb9b44	2025-11-09 03:26:51.263454+00	20251109_rename_payment_enums_for_clarity		\N	2025-11-09 03:26:51.263454+00	0
e6255776-ef50-485b-ac8c-fa8806ebf872	e14a8cf4705b8d532c6c002e4e6ebe2f83dc3482ef4d7b20551314be84731ab8	2025-10-13 05:38:56.659026+00	20250923101707_init_campaign_migration	\N	\N	2025-10-13 05:38:53.905823+00	1
cde74886-9f32-4eb2-a80e-4c0780b96b32	3f2e49de6838524b8824674f2036f507edc1f6ff88506cafa67f27ff78a6a964	2025-10-13 05:39:00.558418+00	20250926151232_add_cover_image_file_key	\N	\N	2025-10-13 05:38:57.796646+00	1
0c8b6b9e-836a-4b93-bbf3-0926a5acebc8	07f5a320c682f31c5e1cb8fbed275d3ce977bc78196f48e1a293baa15ece2e26	2025-10-13 05:39:04.558495+00	20250929101304_add_campaign_categories	\N	\N	2025-10-13 05:39:01.762193+00	1
f79d7604-1304-4e6e-a252-03257b390d01	80cb714125b53a0fe718783aa19b84373add0fa5edc95d23ad4c78bbcf940775	2025-10-27 13:37:11.466821+00	20251026131305_migrate_to_sepay	\N	\N	2025-10-27 13:37:11.466821+00	1
f6d70977-9fa6-4a20-94d5-95162f1c3868	baee7ef88aaf02e9e5e22ccc6a87f5da5722317e0693884c86c957b65621b097	2025-10-13 05:43:34.378753+00	20251013054329_add_extended_campaign_flow_and_social	\N	\N	2025-10-13 05:43:31.703823+00	1
8a6c067b-2c2b-4625-924d-e1678b6a9521	3553e9298d626c3434c3c7c0838fe7cd5ebb94d4b0a81575f18766131006eae8	2025-10-15 05:43:34.300603+00	20251015054329_add_updated_at_to_post_likes	\N	\N	2025-10-15 05:43:31.69559+00	1
d03604dd-e5bf-4470-9722-009ce957e95d	a311afe7166a905e61742c5e5984cff78e12f190d6c746feb71f66ec62eaf5a7	2025-10-15 09:11:47.55988+00	20251015091142_add_is_active_to_post_comments	\N	\N	2025-10-15 09:11:45.20535+00	1
4a54dea4-4256-446d-a95a-b88b65bb0ae7	715531c8926c77b0043a46f6f25794a9a9cbd676706bac8724c3729fa7c5048c	2025-10-20 05:17:57.365136+00	20251020051756_add_pending_payment_status	\N	\N	2025-10-20 05:17:57.18929+00	1
f1c9dee7-1e38-43d1-909f-6ffe7f333a10	8a69348c80d83c26f4eb0bd23d407f15a6568dfc5d26f55043eef77b1cb8a102	2025-10-27 13:40:33.666327+00	20251027134033_add_donor_name	\N	\N	2025-10-27 13:40:33.514813+00	1
39f8e59d-c265-429a-9c32-bf17acb1b714	51b330bd06870b65ae272bef8516658f564d1fc5828f2d4629ec26b754cfa33f	2025-10-21 03:38:09.218513+00	20251021033808_remove_payment_reference	\N	\N	2025-10-21 03:38:09.06378+00	1
c98da2f2-4a93-4ca8-b72f-805fd9b26614	6da65bc52408d34434ad5226fe72f7c873a92168b14dc4953d96c8053520c236	2025-10-21 03:46:04.518457+00	20251021034604_add_field_of_payment_transaction	\N	\N	2025-10-21 03:46:04.365647+00	1
c406a858-491e-4cae-a6e3-8195f7953466	44aae040c45f695531a030b611ea3e0f64e6aa95a6aebc493b1132eb5651d9ac	2025-11-10 16:54:11.17503+00	20251110_add_donation_count_for_payment_transactions		\N	2025-11-10 16:54:11.17503+00	0
63a9c9de-83ea-44d3-9e45-02c07830f49b	875d48350d2c847a57afb23256338ec986993f19dbf897bbf2a05279c870d630	2025-10-24 05:50:02.570115+00	20251024055002_add_payos_webhook_fields	\N	\N	2025-10-24 05:50:02.399152+00	1
856ac794-bdc5-4ed4-984a-64201f30a004	6536446d375f7678983426f43689bb3b248be4faa2dad74abe9b3036a5ba4b3d	2025-10-28 12:40:39.884407+00	20251028_revert_to_payos	\N	\N	2025-10-28 12:40:39.566935+00	1
20d46663-7a05-4147-8741-668a3b71ad92	f60299d0b653c6a8373fc156f78c1c128a8a2302200d50632bfd3866cc5ac140	2025-10-24 14:58:09.621451+00	20251024145809_update_field_map_to_payos_transaction	\N	\N	2025-10-24 14:58:09.464415+00	1
01ba436c-bd60-4408-8644-571e1295ce71	7e40f9db2109ed18514b2072ffa1c8f253de68098fea2cffa90122eacd1496ad	2025-11-13 06:51:11.571173+00	20251113_add_ended_status_baseline		\N	2025-11-13 06:51:11.571173+00	0
5a83d7bb-86c8-447a-8a09-d9a84f3c32f8	210f9041bf80da95a3280fc7cece151c58d1eed45fe11af7e7d450a2cc76fc09	2025-11-13 06:54:05.438824+00	20251110_remove_donation_count		\N	2025-11-13 06:54:05.438824+00	0
f52aa9bd-5260-45dc-9858-6f1388aceee6	b54f235e509c6842185efc20ae8e0337349a753ccf7e813f0b68c67d78672bdf	2025-10-28 13:08:52.027807+00	20251028130851_remove_message	\N	\N	2025-10-28 13:08:51.695433+00	1
838767d8-7823-40b3-9df6-d49420e83c0d	6946d005505e7a68c2ba9c91f8cdfda6757466443fea0b9d0da523af895cb536	2025-11-04 09:11:44.069182+00	20251104091137_add	\N	\N	2025-11-04 09:11:40.783246+00	1
ff29319a-cb2c-4480-a17e-9082ebedf29e	19e7af63d2961fa93cec54ab387020985a411fb9c47f1a252f64e06447f4899a	2025-11-14 09:36:47.822427+00	20251114093303_move_budget_to_phases	\N	\N	2025-11-14 09:36:47.371096+00	1
960f58c1-39bc-4c44-b02d-0f99331fab4c	b6758756a6c76924263db7b69a67a5d7a8b5b0a95d22d48a263ab6d3b1c6f99d	2025-11-04 15:11:28.830919+00	20251104151128_refactor_campaign	\N	\N	2025-11-04 15:11:28.642808+00	1
a57a7b10-0ddd-4c1f-8782-8a4fcc31c19e	2a67287f590cfd40bbcaf36bbbbc95759d9cda16752048c7754685335d8ef775	2025-11-05 03:39:41.794852+00	20251105033941_add_donation_count_and_extension_days	\N	\N	2025-11-05 03:39:41.605016+00	1
3a0ba83d-cc8e-415a-96da-3d871716cd20	e509c1870cd4392c0979abb81e842a1cacc57367d025b2e51bb94d93d5818f4c	2025-11-07 13:14:12.49163+00	20251107_add_payment_gateway_fields		\N	2025-11-07 13:14:12.49163+00	0
c6721195-7f87-493b-ad08-82490a20688b	238016c86f5d27770630ed95e17f48eeabb177697c5352bba4102b8872dc6209	2025-11-08 17:49:49.006886+00	20251109_add_payment_completion_tracking		\N	2025-11-08 17:49:49.006886+00	0
05f52be8-7a12-4bd2-8bfd-93a36b980e1d	e1c72c9b1cd61f38b8f6d935e5074d2c02f9c395f12bf4faf20dcfb336e97a27	2025-11-08 17:54:49.139289+00	20251109_refactor_to_jsonb_metadata		\N	2025-11-08 17:54:49.139289+00	0
8193a8d7-09f7-4a32-8509-e01d40006ed3	4f539e4d755deb8017965fa70e8e151735e1a8ad268e3bef762a241a8aa9c25c	2025-11-18 06:50:28.893908+00	20251118053704_add_notifications_table	\N	\N	2025-11-18 06:50:28.669556+00	1
39be0a0f-ab66-4860-ac03-95b663127282	a0bc7cb2c52d0cfd44244be0ed45ce7094b76b5fae173867bcdf4d0ccb9a7773	2025-11-28 12:27:29.813623+00	20251128122728_add_table_outbox_event	\N	\N	2025-11-28 12:27:29.27419+00	1
b5fe9353-9a10-4591-870e-c724bb606dc9	160a5b6f1bdc621d3498ad0e3b8bd43d4eeae947639c8e1e46c42e49369e335f	2025-11-18 06:58:59.202282+00	20251118070000_add_notifications_partitioned		\N	2025-11-18 06:58:59.202282+00	0
e0e02d59-debf-4a52-b74a-c72827a2b2a3	4371b0f44be34ea51ecdc8c83e77132f7e752e9ce68aedbf72955b668a5e217c	2025-11-19 08:06:56.406849+00	20251119120000_add_reason_field_to_campaign		\N	2025-11-19 08:06:56.406849+00	0
23b2f017-2699-4d90-b754-24dddaaf33b2	90551f7ead36f31d2528056a86d80cef118a27840f6be8f16805f2dcc23f40ad	2025-11-25 05:22:55.329308+00	20251120000000_sync_notifications_indexes	\N	\N	2025-11-25 05:22:55.033797+00	1
ff60dc4d-1e93-4925-9291-ce2deff9fced	8e37f49ae4c05b9d54f0a1c4c9c52066290c154f016ffae9ce42175f974ba42f	2025-11-25 05:55:47.824622+00	20251119000000_baseline_notification_schema		\N	2025-11-25 05:55:47.824622+00	0
c15120d2-af2e-4800-94eb-c864cf641b84	845ea403433a89affa1acc283b96ba25f75931fc66c451e0a3299dcc62187fde	2025-11-25 05:56:38.307266+00	20251125055637_add_organization_id_to_campaigns	\N	\N	2025-11-25 05:56:38.056309+00	1
dcc202e2-5cdb-4fdc-a552-68e2ac88138b	dce24b26f8f3000aac553f134810bdda95b1ce91249025458f4f04d33b9c0046	2025-12-05 09:46:50.458563+00	20251205094650_add_surplus_transferred_notification_type	\N	\N	2025-12-05 09:46:50.265793+00	1
ebe47010-fe05-4512-9ce9-bf172ea4f945	e69d51c25ef3c33f13e6a0d627d0861985b57e49f9566af420752e6b4d2044e7	2025-11-27 07:24:26.108202+00	20251127072425_add_campaign_reassignment	\N	\N	2025-11-27 07:24:25.917952+00	1
f6165db7-9414-4762-808a-2a62124c09a9	e2784a267c123bcce84ac8cc82ebd5c1d7b6aea5557115aa06d05c52920f53cb	2025-11-28 06:16:10.006889+00	20251128061609_add_campaign_slug	\N	\N	2025-11-28 06:16:09.740759+00	1
ae12c358-3522-423e-bde4-04893579d1c1	4df65ff803fe47e4420df617361d58f46da7827fa56c9e25030d4b9b2def33ed	2025-12-06 12:31:50.904127+00	20251206123149_add_planned_meals_and_ingredients	\N	\N	2025-12-06 12:31:50.40951+00	1
86a4d1ff-1f1a-477e-bc96-e7ef868bb2af	e434458844a2296028059ff2aeddd71d4d9b60ed6d6c421620328712fe38d023	2025-12-08 07:36:01.288156+00	20251208073600_update_planned_ingredient_quantity_to_decimal	\N	\N	2025-12-08 07:36:00.752605+00	1
3c90879d-ca71-4ff6-8ebe-f999090b3953	72b4d2ac5e0d316508257602327cd4b78c9d42daeaa5c1ba98f332c4662449d7	2025-12-08 13:41:11.306576+00	20251208134110_remove_awaiting_audit_from_phase_status	\N	\N	2025-12-08 13:41:10.872722+00	1
\.


--
-- TOC entry 4791 (class 0 OID 21605)
-- Dependencies: 224
-- Data for Name: campaign_categories; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.campaign_categories (id, title, description, is_active, created_at, updated_at) FROM stdin;
40815d98-bc0a-4a41-a60f-677b11ccc623	Thực phẩm cho dân tộc thiểu số	Hỗ trợ gạo, thực phẩm cho bản làng xa xôi.	t	2025-10-13 11:00:57.605	2025-10-13 11:00:57.605
32c2ba4f-a6ef-4cf3-a627-a5185a33289b	Xóa đói, hỗ trợ thức ăn	Hỗ trợ gạo, thực phẩm cho bản làng xa xôi.	t	2025-10-14 10:03:33.552	2025-10-14 10:04:12.873
c119370b-7d28-475a-b4f9-210c80e8879b	Hỗ trợ suất ăn	Chiến dịch hỗ trợ học sinh nghèo	t	2025-10-28 07:45:05.015	2025-10-28 07:45:05.015
3e25eb72-db9e-4c00-bcda-ed4863a4aa43	Test suất ăn	Chiến dịch hỗ trợ học sinh nghèo	f	2025-10-28 07:46:08.513	2025-10-28 07:51:55.461
cad5fd67-65ea-4fb2-a67e-57d417f6fce4	Test suất ăn	Chiến dịch hỗ trợ học sinh nghèo	f	2025-10-28 09:02:10.018	2025-10-28 09:02:43.952
56e7b450-2e51-4e3d-b1cc-726ea4692b60	Bữa ăn học đường	Gây quỹ cho học sinh nghèo.	t	2025-10-30 06:51:48.646	2025-10-30 06:51:48.646
745665c5-9891-44a2-acc2-748e032214ce	Bữa ăn bệnh nhân	Hỗ trợ suất ăn cho bệnh nhân, người nhà bệnh nhân ở bệnh viện.	t	2025-10-30 06:52:00.285	2025-10-30 06:52:00.285
2e9df723-2f97-4229-ad85-1f182f420df1	Bữa ăn công nhân	Hỗ trợ suất ăn cho công nhân có thu nhập thấp, bị mất việc.	t	2025-10-30 06:52:10.005	2025-10-30 06:52:10.005
7d04b7d8-d26c-416e-ac02-459c06cd841b	Bữa ăn người vô gia cư	Cung cấp bữa ăn cho người lang thang, vô gia cư.	t	2025-10-30 06:52:28.723	2025-10-30 06:52:28.723
6c14b19f-d471-40b9-8b77-84055648fa98	Bữa ăn cộng đồng – người già neo đơn	Cung cấp thực phẩm cho người cao tuổi, cô đơn, không nơi nương tựa.	t	2025-10-30 06:52:49.544	2025-10-30 06:52:49.544
cf2bcf45-b67b-48be-b15d-54ebf74e0456	Giải cứu động vật	Hỗ trợ thức ăn cho động vật bị bỏ rơi	t	2025-11-13 13:13:10.079	2025-11-13 13:13:10.079
\.


--
-- TOC entry 4796 (class 0 OID 29631)
-- Dependencies: 229
-- Data for Name: campaign_phases; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.campaign_phases (id, campaign_id, phase_name, location, ingredient_purchase_date, cooking_date, delivery_date, status, created_at, updated_at, is_active, ingredient_budget_percentage, cooking_budget_percentage, delivery_budget_percentage) FROM stdin;
4ace64c3-92a3-4016-a4ac-15d10dbf4327	26c6c46f-e062-4e93-a0c6-8de421d47163	10 suất ăn cho sinh viên	FPT	2025-12-06 00:00:00	2025-12-07 00:00:00	2025-12-08 00:00:00	PLANNING	2025-12-03 14:31:54.486	2025-12-03 14:31:54.486	t	80.00	10.00	10.00
85678bc4-a734-4420-974a-be918d3b7e73	59ea53fb-54e3-4dcd-80bd-a3dd4b9ab2c5	Bệnh viện trung ương A	Hẻm 174/53 Thái Phiên, Phường Bình Thới, Thành phố Hồ Chí Minh	2025-12-11 07:00:00	2025-12-11 09:00:00	2025-12-11 11:00:00	PLANNING	2025-12-04 03:28:17.537	2025-12-04 03:28:17.537	t	80.00	15.00	5.00
b3b11892-7442-44c6-a511-03a15ca3ad58	297bd913-1aa0-4d7d-bb05-073f7998bc4b	Chùa Tường Nguyên	Đường Tân Khai, Phường Minh Phụng, Thành phố Thủ Đức	2025-12-21 07:00:00	2025-12-21 09:00:00	2025-12-21 11:00:00	PLANNING	2025-12-04 03:32:00.368	2025-12-04 03:32:00.368	t	85.00	10.00	5.00
9c08d582-833f-4c96-b8b9-2852cc0b8d68	d54e8ca1-86e8-43b9-8771-8c8ab07af4b8	Bệnh viện đa khoa A	Hẻm 436 Hòa Hảo, Phường Diên Hồng, Thành phố Thủ Đức	2025-12-26 07:00:00	2025-12-26 09:00:00	2025-12-26 13:00:00	PLANNING	2025-12-04 03:35:13.361	2025-12-04 03:35:13.361	t	90.00	5.00	5.00
11021216-2e14-4d6f-b7c8-d5b629ab6439	cc29b597-e75e-4a62-8258-5b1fced63534	Nguyễn Đình Khơi	Hẻm 137 Phan Anh, Phường Bình Trị Đông, Thành phố Hồ Chí Minh	2026-01-05 07:00:00	2026-01-05 09:00:00	2026-01-05 11:00:00	PLANNING	2025-12-04 03:42:05.939	2025-12-04 03:42:05.939	t	80.00	15.00	5.00
cf400017-bde6-4391-b108-45cb65878c1a	005725f5-42ed-4df5-8aef-7f22ca08a93c	Nhà trẻ An Bình	126, Tô Hiệu, Phường Phú Thạnh, Thành phố Hồ Chí Minh	2025-12-11 07:00:00	2025-12-11 09:00:00	2025-12-11 11:00:00	PLANNING	2025-12-02 15:52:55.866	2025-12-02 15:52:55.866	t	80.00	15.00	5.00
58297e59-485f-49ac-89a0-7dd994614119	84a8f4d0-127d-4283-adaa-0b6a65af65e0	Giai đoạn A	Đường Thái Phiên, Phường Minh Phụng, Thành phố Hồ Chí Minh	2025-12-21 07:00:00	2025-12-21 09:00:00	2025-12-21 11:00:00	PLANNING	2025-12-04 04:51:54.794	2025-12-04 04:51:54.794	t	80.00	10.00	10.00
2aa58568-21a5-4ba5-a341-7fce48906f9b	717beed7-cf9f-40de-912f-88ab1a883222	Giai đoạn 1	Phường Phú Thọ, Thành phố Hồ Chí Minh	2025-12-21 07:00:00	2025-12-21 09:00:00	2025-12-21 13:00:00	PLANNING	2025-12-04 05:19:16.941	2025-12-04 05:19:16.941	t	70.00	15.00	15.00
2f68ae76-32b6-411d-8f47-6c693ccc47a2	a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961	Giai đoạn 1	Hẻm 7A Thành Thái, Phường Diên Hồng, Thành phố Thủ Đức	2025-12-11 07:00:00	2025-12-11 09:00:00	2025-12-11 13:00:00	PLANNING	2025-12-04 06:31:28.384	2025-12-04 06:31:28.384	t	85.00	10.00	5.00
898dccc9-41d2-4035-a354-6284eca947fb	14ad34dc-dc0c-42f8-868c-237fe766ca9a	Suất ăn trưa cho sinh viên Đại học	256, Đường Ngô Quyền, Phường Diên Hồng, Thành phố Thủ Đức	2025-12-06 00:00:00	2025-12-07 00:00:00	2025-12-08 00:00:00	AWAITING_INGREDIENT_DISBURSEMENT	2025-12-03 14:14:17.221	2025-12-05 05:59:18.164	t	86.00	10.00	4.00
4119c551-0360-4e9b-a434-2c19c5cee97d	a8e5ebd1-e861-4ac9-b0b6-cb2f9fef72d9	Công viên B5	Quận 1, TP.HCM	2025-12-15 08:00:00	2025-12-16 18:00:00	2025-12-17 07:00:00	PLANNING	2025-12-08 07:50:53.566	2025-12-08 07:50:53.566	t	70.00	25.00	5.00
860f554b-fbab-4c42-b831-3a34584e084e	431119ca-66b6-4ade-bbe1-b06a52016fa8	Công viên B5	Quận 1, TP.HCM	2025-12-09 08:00:00	2025-12-10 18:00:00	2025-12-11 07:00:00	COMPLETED	2025-12-07 02:08:09.124	2025-12-08 14:10:37.735	t	70.00	25.00	5.00
88264966-d7a3-4e19-8ea4-276ceceadd36	07cf05f5-0be5-46f0-bd83-83ed9dd5f679	Giai đoạn 1	61, Phạm Đình Hổ, Phường Bình Tây, Thành phố Hồ Chí Minh	2025-12-09 07:00:00	2025-12-09 09:00:00	2025-12-09 13:00:00	PLANNING	2025-12-04 05:24:22.647	2025-12-04 05:24:22.647	t	80.00	10.00	10.00
9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	f9bd788e-1594-48e2-8c0a-e0f16ddb909a	Khu ổ chuột A	Hẻm 186 Bình Thới, Phường Hòa Bình, Thành phố Hồ Chí Minh	2025-12-21 07:00:00	2025-12-21 09:00:00	2025-12-21 13:00:00	AWAITING_INGREDIENT_DISBURSEMENT	2025-12-09 07:30:28.72	2025-12-09 15:20:16.545	t	80.00	10.00	10.00
f32a9f41-d632-4eec-99ec-0165ee53f4d0	6114ee01-0a44-44f9-a7ee-e23e2a9f7575	Nấu ăn cho công nhân	Công Trường Dân Chủ, Phường Nhiêu Lộc, Thành phố Thủ Đức	2025-12-04 00:00:00	2025-12-05 00:00:00	2025-12-06 00:00:00	AWAITING_COOKING_DISBURSEMENT	2025-12-02 15:27:18.094	2025-12-10 17:40:01.777	t	80.00	10.00	10.00
\.


--
-- TOC entry 4800 (class 0 OID 75289)
-- Dependencies: 234
-- Data for Name: campaign_reassignments; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.campaign_reassignments (id, campaign_id, organization_id, status, assigned_at, expires_at, responded_at, response_note, created_at, updated_at) FROM stdin;
b9c24ebf-5555-44ee-aeb8-6c4076d461d9	005725f5-42ed-4df5-8aef-7f22ca08a93c	725efdad-4e50-48df-8c57-4af0de83d68b	APPROVED	2025-12-02 19:15:47.555	2025-12-09 19:15:47.504	2025-12-02 19:25:02.995	Chúng tôi chấp nhận tiếp quản chiến dịch và sẽ liên hệ donor để tiếp tục	2025-12-02 19:15:47.555	2025-12-02 19:25:03.012
ede51dab-e8d6-4241-8a8b-b44d881009d7	005725f5-42ed-4df5-8aef-7f22ca08a93c	eb590ab7-df52-4201-85c1-645dd9f626a4	REJECTED	2025-12-02 19:15:47.555	2025-12-09 19:15:47.504	2025-12-02 19:25:03.334	Auto-rejected: Another organization accepted	2025-12-02 19:15:47.555	2025-12-02 19:25:03.336
14d2faa0-513e-4e7f-8eba-4a99fbbb5c0e	a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961	912bdb9f-b167-49b0-89c2-3495ffbad0dc	PENDING	2025-12-07 07:19:07.636	2025-12-14 07:19:07.629	\N	\N	2025-12-07 07:19:07.636	2025-12-07 07:19:07.636
15ba0a22-7031-415b-8e74-f02432af6bac	a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961	2ebfb7ae-2dac-47d2-ab0e-8229be785e66	PENDING	2025-12-07 07:37:48.758	2025-12-14 07:37:48.755	\N	\N	2025-12-07 07:37:48.758	2025-12-07 07:37:48.758
\.


--
-- TOC entry 4789 (class 0 OID 21571)
-- Dependencies: 222
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.campaigns (id, title, description, cover_image, target_amount, received_amount, status, is_active, created_by, created_at, updated_at, cover_image_file_key, category_id, completed_at, fundraising_end_date, fundraising_start_date, changed_status_at, extension_count, extension_days, donation_count, reason, organization_id, cancelled_at, previous_status, slug) FROM stdin;
005725f5-42ed-4df5-8aef-7f22ca08a93c	CẦN LẮM NHỮNG BỮA CƠM CÓ THỊT CHO TRẺ EM NGHÈO	<p class="tiptap-paragraph">150,000đ có lẽ sẽ không giúp thay đổi được cuộc đời của một con người.<br><br>Nhưng nếu nhiều người cùng chung tay với con số: 150,000đ đó thì chắc chắn sẽ tạo ra sự thay đổi to lớn bằng cách "trao cơ hội đi học, cho cơ hội đổi đời, và các em được nâng cao thể trạng".<br>_______________________________<br>THÔNG TIN NHẬN QUYÊN GÓP CHI PHÍ HOẠT ĐỘNG:<br>Ngân hàng Thương mại cổ phần Quân đội (MB Bank)<br>✅ Số tài khoản: 8992<br>✅ Tên tài khoản: TIEP BUOC TOI TRUONG<br>Nội dung chuyển khoản: Tên Quý MTQ + UNG HO DU AN<br>Mọi thông tin chi tiết xin vui lòng liên hệ:<br>Fanpage: Tiếp Bước Tới Trường<br>☎️Hotline: 0899288222<br>Email: <a target="_blank" rel="noopener noreferrer nofollow" href="mailto:tiepbuoctoitruong22@gmail.com">tiepbuoctoitruong22@gmail.com</a><br>#Tiepbuoctoitruong<br>#TBTT <br></p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-02/c1e8302a-temp-1764690718932-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	20000	19000	PROCESSING	t	093a850c-9071-7022-834c-6e87976abadb	2025-12-02 00:00:00	2025-12-10 17:00:00.952	campaigns/2025-12-02/c1e8302a-temp-1764690718932-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	56e7b450-2e51-4e3d-b1cc-726ea4692b60	\N	2025-12-10 00:00:00	2025-12-02 00:00:00	2025-12-02 18:33:45.231	0	0	8	\N	725efdad-4e50-48df-8c57-4af0de83d68b	\N	\N	can-lam-nhung-bua-com-co-thit-cho-tre-em-ngheo
717beed7-cf9f-40de-912f-88ab1a883222	Học sinh trường Chu Văn An	<p class="tiptap-paragraph">Học sinh trường Chu Văn An</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/803005b9-temp-1764825530981-093a850c-9071-7022-834c-6e87976abadb.jpg	200000	0	ACTIVE	t	093a850c-9071-7022-834c-6e87976abadb	2025-12-04 05:19:16.873	2025-12-05 17:00:00.816	campaigns/2025-12-04/803005b9-temp-1764825530981-093a850c-9071-7022-834c-6e87976abadb.jpg	745665c5-9891-44a2-acc2-748e032214ce	\N	2025-12-20 00:00:00	2025-12-05 00:00:00	2025-12-04 05:19:43.723	0	0	0	\N	725efdad-4e50-48df-8c57-4af0de83d68b	\N	\N	hoc-sinh-truong-chu-van-an
a8e5ebd1-e861-4ac9-b0b6-cb2f9fef72d9	Chương trình Suất ăn miễn phí cho Đình Luyện	Quyên góp để cooking bữa ăn đầy hải sản sau những tháng làm đồ án đầy khó khăn	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-07/baa19da8-temp-1765072886884-19eaa51c-5061-7097-52d0-fa60f6db38e1.jpg	25000	0	PENDING	t	19eaa51c-5061-7097-52d0-fa60f6db38e1	2025-12-08 07:50:53.487	2025-12-08 07:50:53.487	campaigns/2025-12-07/baa19da8-temp-1765072886884-19eaa51c-5061-7097-52d0-fa60f6db38e1.jpg	745665c5-9891-44a2-acc2-748e032214ce	\N	2025-12-11 00:00:00	2025-12-09 13:00:00	\N	0	0	0	\N	eb590ab7-df52-4201-85c1-645dd9f626a4	\N	\N	chuong-trinh-suat-an-mien-phi-cho-dinh-luyen-iqwqfv
59ea53fb-54e3-4dcd-80bd-a3dd4b9ab2c5	CƠM 0đ cho Bệnh Nhân nghèo, bệnh nhân ung thư, chạy thận	<p class="tiptap-paragraph">Làm con người ai cũng sẽ có Sanh - Già - Bệnh - Chết. Không gì khổ bằng nỗi đau bệnh tật. Bệnh tật làm con người ta suy kiệt cả về vật chất lẫn tinh thần. Mong muốn mang lại những bữa ăn ấm lòng , động viên ,khích lệ và  xoa dịu nỗi đau cho các bệnh nhân. Phúc lâm tự tay làm những xuất cơm, cháo đầy đủ dưỡng chất và đảm bảo vệ sinh cho người bệnh với giá 0đ. Hàng trăm xuất cơm và xuất cháo được chuyển trực tiếp đến tay các bệnh nhân qua kết nối của phòng công tác xã hội của các bệnh viện. Rất mong nhận được sự ủng hộ và đồng hành của các nhà hảo tâm. các bệnh nhân cần các bạn.<br>" Người ta tích bạc tích vàng, tôi đây tích đức để đời mai sau".<br>Hy vọng những mầm xanh hạt thiện mà Phúc Lâm gieo trồng sẽ sớm nảy mầm thành rừng công đức cho khắp hết mọi người cùng hưởng trái ngọt trong tương lai❤️❤️❤️❤️ </p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/ed9b3415-temp-1764818838182-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	20000	0	ENDED	t	d96ae52c-1031-70ec-91a7-8a77026ec88c	2025-12-04 03:28:17.478	2025-12-10 17:00:00.85	campaigns/2025-12-04/ed9b3415-temp-1764818838182-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	745665c5-9891-44a2-acc2-748e032214ce	2025-12-10 17:00:00.825	2025-12-10 00:00:00	2025-12-04 00:00:00	2025-12-04 03:35:59.622	0	0	0	\N	1c017129-7db6-42f5-99d7-5d209dfc1087	\N	\N	com-0d-cho-benh-nhan-ngheo-benh-nhan-ung-thu-chay-than
d54e8ca1-86e8-43b9-8771-8c8ab07af4b8	Tô Cơm Hạnh Phúc - Cơm 0₫	<p class="tiptap-paragraph"><em>Tô Cơm Hạnh Phúc&nbsp;</em></p><p class="tiptap-paragraph">-----------------------------------------</p><p class="tiptap-paragraph">THÔNG TIN LIÊN HỆ</p><p class="tiptap-paragraph">👤Chủ Nhiệm CLB: Tran Xuan An&nbsp;</p><p class="tiptap-paragraph">☎️ Số điện thoại: 0396.742.232</p><p class="tiptap-paragraph">🌐 Fanpage: <a target="_blank" rel="noopener noreferrer nofollow" href="https://www.facebook.com/share/1DoaxkS6C1/?mibextid=LQQJ4d">https://www.facebook.com/share/1DoaxkS6C1/?mibextid=LQQJ4d</a></p><p class="tiptap-paragraph">👫 Group: <a target="_blank" rel="noopener noreferrer nofollow" href="https://zalo.me/g/gqbhgu819">https://zalo.me/g/gqbhgu819</a></p><p class="tiptap-paragraph">#CLBThiệnNguyệnGieoMầmXanhThànhPhốViệtTrì&nbsp;</p><p class="tiptap-paragraph"> <br></p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/5a94deae-temp-1764819279716-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	25000	0	ACTIVE	t	d96ae52c-1031-70ec-91a7-8a77026ec88c	2025-12-04 03:35:13.316	2025-12-04 03:36:08.374	campaigns/2025-12-04/5a94deae-temp-1764819279716-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	6c14b19f-d471-40b9-8b77-84055648fa98	\N	2025-12-25 00:00:00	2025-12-04 00:00:00	2025-12-04 03:36:08.333	0	0	0	\N	1c017129-7db6-42f5-99d7-5d209dfc1087	\N	\N	to-com-hanh-phuc-com-0
07cf05f5-0be5-46f0-bd83-83ed9dd5f679	Cơ sở Lê Lợi	<p class="tiptap-paragraph">Test cái ví</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/1f2fd3c8-temp-1764825833517-093a850c-9071-7022-834c-6e87976abadb.jpg	60000	60000	PROCESSING	t	093a850c-9071-7022-834c-6e87976abadb	2025-12-04 05:24:22.439	2025-12-07 17:00:00.548	campaigns/2025-12-04/1f2fd3c8-temp-1764825833517-093a850c-9071-7022-834c-6e87976abadb.jpg	56e7b450-2e51-4e3d-b1cc-726ea4692b60	\N	2025-12-26 00:00:00	2025-12-06 00:00:00	2025-12-04 05:30:16.472	0	0	0	\N	725efdad-4e50-48df-8c57-4af0de83d68b	\N	\N	co-so-le-loi
6114ee01-0a44-44f9-a7ee-e23e2a9f7575	Phụ giúp cơm trưa cho công trường	<p class="tiptap-paragraph">Phụ giúp cơm trưa cho công trường dân chủ</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-02/89d6aefd-temp-1764689199121-793a75fc-40a1-70e2-9d09-9a0f86a6f48f.jpg	200000	200000	PROCESSING	t	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	2025-12-02 15:27:17.989	2025-12-02 17:00:00.681	campaigns/2025-12-02/89d6aefd-temp-1764689199121-793a75fc-40a1-70e2-9d09-9a0f86a6f48f.jpg	2e9df723-2f97-4229-ad85-1f182f420df1	\N	2025-12-03 23:59:00	2025-12-02 08:00:00	2025-12-02 15:28:16.118	0	0	1	\N	ecb3e803-18c2-48a8-b450-f665d62128b8	\N	\N	phu-giup-com-trua-cho-cong-truong
cc29b597-e75e-4a62-8258-5b1fced63534	Quỹ nấu cơm hằng tuần	<p class="tiptap-paragraph">Quỹ nấu cơm cho người nghèo và vô gia cư ở Sài gòn</p><p class="tiptap-paragraph">Lịch nấu cố định thứ 7 hằng tuần tại 8/35 Nguyễn Đình Khơi P4 Q Tân Bình</p><p class="tiptap-paragraph">Nấu và vô hộp 14h</p><p class="tiptap-paragraph">Phát 16-18h</p><p class="tiptap-paragraph">Đăng ký làm tình nguyện viên hằng tuần tại Page Fb <a target="_blank" rel="noopener noreferrer nofollow" href="http://Homelessdreams.vn">Homelessdreams.vn</a></p><p class="tiptap-paragraph">Từ thiện tại tâm, các thành viên tham gia không yêu cầu đóng bất kỳ chi phí nào</p><p class="tiptap-paragraph">Z@l0 0961086818</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/e526d083-temp-1764819696042-093a850c-9071-7022-834c-6e87976abadb.jpg	220000	500000	PROCESSING	t	093a850c-9071-7022-834c-6e87976abadb	2025-12-04 03:42:05.907	2025-12-04 04:48:27.152	campaigns/2025-12-04/e526d083-temp-1764819696042-093a850c-9071-7022-834c-6e87976abadb.jpg	c119370b-7d28-475a-b4f9-210c80e8879b	\N	2026-01-04 00:00:00	2025-12-04 00:00:00	2025-12-04 04:48:27.152	0	0	1	\N	725efdad-4e50-48df-8c57-4af0de83d68b	\N	ACTIVE	quy-nau-com-hang-tuan
14ad34dc-dc0c-42f8-868c-237fe766ca9a	Suất ăn cho sinh viên Đại học	<p class="tiptap-paragraph">Suất ăn cho sinh viên Đại học</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-03/a69801c1-temp-1764771217204-59ca659c-60c1-70d7-23dd-3a26a0c5df58.jpg	100000	100000	PROCESSING	t	59ca659c-60c1-70d7-23dd-3a26a0c5df58	2025-12-03 14:14:17.2	2025-12-04 17:00:00.312	campaigns/2025-12-03/a69801c1-temp-1764771217204-59ca659c-60c1-70d7-23dd-3a26a0c5df58.jpg	56e7b450-2e51-4e3d-b1cc-726ea4692b60	\N	2025-12-05 00:00:00	2025-12-04 00:00:00	2025-12-03 15:50:46.912	0	0	1	\N	69d6e983-61aa-4eda-b1b8-fc72329e033a	\N	\N	suat-an-cho-sinh-vien-dai-hoc
a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961	Hỗ trợ sinh viên Chu Văn An	<p class="tiptap-paragraph">Hỗ trợ sinh viên</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/93da8bf9-temp-1764829844984-c9ea352c-00d1-706a-26f3-236361e805d4.jpg	20000	0	CANCELLED	t	c9ea352c-00d1-706a-26f3-236361e805d4	2025-12-04 06:31:28.361	2025-12-07 07:05:36.151	campaigns/2025-12-04/93da8bf9-temp-1764829844984-c9ea352c-00d1-706a-26f3-236361e805d4.jpg	745665c5-9891-44a2-acc2-748e032214ce	\N	2025-12-10 00:00:00	2025-12-05 00:00:00	2025-12-07 07:05:36.136	0	0	0	Dính drama	3c6d7899-119a-4483-bf63-e3226c261a93	\N	\N	ho-tro-sinh-vien-chu-van-an
84a8f4d0-127d-4283-adaa-0b6a65af65e0	Sinh viên	<p class="tiptap-paragraph">Sinh viên</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/7aacef9e-temp-1764823894932-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	200000	2000	ACTIVE	t	d96ae52c-1031-70ec-91a7-8a77026ec88c	2025-12-04 04:51:54.76	2025-12-10 07:29:05.594	campaigns/2025-12-04/7aacef9e-temp-1764823894932-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	745665c5-9891-44a2-acc2-748e032214ce	\N	2025-12-20 00:00:00	2025-12-05 00:00:00	2025-12-04 04:52:12.98	0	0	1	\N	1c017129-7db6-42f5-99d7-5d209dfc1087	\N	\N	sinh-vien
26c6c46f-e062-4e93-a0c6-8de421d47163	Sinh viên FPT	<p class="tiptap-paragraph">Sinh viên FPTU123</p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-03/01e41e18-temp-1764772292727-59ca659c-60c1-70d7-23dd-3a26a0c5df58.jpg	100000	0	REJECTED	t	59ca659c-60c1-70d7-23dd-3a26a0c5df58	2025-12-03 14:31:54.419	2025-12-03 15:50:38.432	campaigns/2025-12-03/01e41e18-temp-1764772292727-59ca659c-60c1-70d7-23dd-3a26a0c5df58.jpg	56e7b450-2e51-4e3d-b1cc-726ea4692b60	\N	2025-12-05 00:00:00	2025-12-04 00:00:00	2025-12-03 15:50:38.416	0	0	0	Bi lap	69d6e983-61aa-4eda-b1b8-fc72329e033a	\N	\N	sinh-vien-fpt
297bd913-1aa0-4d7d-bb05-073f7998bc4b	Bữa Cơm Yêu Thương	<p class="tiptap-paragraph">Đều đặn thứ tư và chủ nhật hằng tuần, bếp ăn của các phật tử chùa Tường Nguyên lại nấu hàng ngàn suất cơm 0 đồng giúp người mưu sinh và bệnh nhân, người nhà điều trị tại bệnh viện.<br><br>Chùa Tường Nguyên (Q.4, TP.HCM) hiện có 2 bếp ăn 0 đồng: một bếp tại chùa nấu vào thứ tư, một bếp tại Huyện Nhà Bè nấu vào chủ nhật với khoảng 5.000 suất cơm/tuần. </p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-04/ad7e50df-temp-1764819089322-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	20000	0	ACTIVE	t	d96ae52c-1031-70ec-91a7-8a77026ec88c	2025-12-04 03:32:00.29	2025-12-04 03:36:03.608	campaigns/2025-12-04/ad7e50df-temp-1764819089322-d96ae52c-1031-70ec-91a7-8a77026ec88c.jpg	6c14b19f-d471-40b9-8b77-84055648fa98	\N	2025-12-20 00:00:00	2025-12-04 00:00:00	2025-12-04 03:36:03.586	0	0	0	\N	1c017129-7db6-42f5-99d7-5d209dfc1087	\N	\N	bua-com-yeu-thuong
431119ca-66b6-4ade-bbe1-b06a52016fa8	Chương trình Suất ăn miễn phí cho Đình Luyện	Quyên góp để cooking bữa ăn đầy hải sản sau những tháng làm đồ án đầy khó khăn	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-07/baa19da8-temp-1765072886884-19eaa51c-5061-7097-52d0-fa60f6db38e1.jpg	25000	20000	COMPLETED	t	19eaa51c-5061-7097-52d0-fa60f6db38e1	2025-12-07 02:08:08.879	2025-12-08 14:10:40.725	campaigns/2025-12-07/baa19da8-temp-1765072886884-19eaa51c-5061-7097-52d0-fa60f6db38e1.jpg	745665c5-9891-44a2-acc2-748e032214ce	2025-12-08 14:10:40.721	2025-12-09 00:00:00	2025-12-07 13:00:00	2025-12-08 14:10:40.721	0	0	0	\N	eb590ab7-df52-4201-85c1-645dd9f626a4	\N	\N	chuong-trinh-suat-an-mien-phi-cho-dinh-luyen
f9bd788e-1594-48e2-8c0a-e0f16ddb909a	Góp Gạo Nuôi Bé	<p class="tiptap-paragraph"><strong>Dự án Góp Gạo Nuôi Bé – Cùng Thắp Sáng Tương Lai!</strong></p><p class="tiptap-paragraph"><strong>Mục đích:</strong></p><p class="tiptap-paragraph">Dự án nhằm hỗ trợ trẻ em dân tộc thiểu số vùng sâu vùng xa tại Tây Nguyên được no bụng hơn khi đến trường, từ đó khuyến khích cha mẹ cho con em đi học đều đặn. Đây không chỉ là hành động trao đi bữa ăn mà còn là cách gieo hy vọng về một tương lai tươi sáng hơn cho các em nhỏ.</p><p class="tiptap-paragraph"><strong>Hình thức tham gia:</strong></p><p class="tiptap-paragraph">&nbsp;• Quý anh/chị tham gia dự án với mức hỗ trợ 200.000 VNĐ/bé/tháng và cam kết hỗ trợ tối thiểu 1 năm.</p><p class="tiptap-paragraph">&nbsp;• Sau khi đồng ý tham gia, quý anh/chị sẽ nhận được đầy đủ thông tin, hình ảnh và mã nhận nuôi của bé.</p><p class="tiptap-paragraph"><strong>Thông tin chuyển khoản:</strong></p><p class="tiptap-paragraph">&nbsp;• Số tài khoản thiện nguyện MB Bank: <em>3872 – Hoàng Công Minh</em></p><p class="tiptap-paragraph">&nbsp;• Quý anh/chị có thể theo dõi chi tiết sao kê trên ứng dụng Thiện Nguyện để đảm bảo sự minh bạch.</p><p class="tiptap-paragraph"><strong>Liên hệ phụ trách dự án:</strong></p><p class="tiptap-paragraph">&nbsp;• SĐT: 0849.925.925 (Hoàng Công Minh)</p><p class="tiptap-paragraph">Mỗi sự đóng góp nhỏ sẽ tạo nên những thay đổi lớn, mang lại nụ cười và niềm tin cho các em nhỏ nơi vùng cao. Rất mong nhận được sự đồng hành của quý nhà hảo tâm gần xa!</p><p class="tiptap-paragraph">Cùng chung tay để các bé được đến trường với chiếc bụng no và một tương lai rộng mở hơn!</p><p class="tiptap-paragraph"> <br></p>	https://foodfund.sgp1.cdn.digitaloceanspaces.com/campaigns/2025-12-09/eac0b77f-temp-1765265102328-19eaa51c-5061-7097-52d0-fa60f6db38e1.jpg	20000	16000	CANCELLED	t	19eaa51c-5061-7097-52d0-fa60f6db38e1	2025-12-09 07:30:28.494	2025-12-09 17:00:00.368	campaigns/2025-12-09/eac0b77f-temp-1765265102328-19eaa51c-5061-7097-52d0-fa60f6db38e1.jpg	32c2ba4f-a6ef-4cf3-a627-a5185a33289b	\N	2025-12-09 00:00:00	2025-12-08 00:00:00	2025-12-09 14:58:58.34	0	0	0	\N	eb590ab7-df52-4201-85c1-645dd9f626a4	\N	\N	gop-gao-nuoi-be
\.


--
-- TOC entry 4790 (class 0 OID 21584)
-- Dependencies: 223
-- Data for Name: donations; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.donations (id, donor_id, campaign_id, amount, is_anonymous, created_at, donor_name) FROM stdin;
97373473-be11-45ee-99c2-9ce5a8823587	696a959c-c031-701c-085a-ff780e5b0f07	6114ee01-0a44-44f9-a7ee-e23e2a9f7575	200000	t	2025-12-02 16:42:46.102	Người dùng ẩn danh
3a4d44f4-3bf7-41d8-b4f7-5d9162cff157	Người dùng ẩn danh	005725f5-42ed-4df5-8aef-7f22ca08a93c	3000	t	2025-12-03 11:39:34.505	Người dùng ẩn danh
abb90d28-aa89-4425-b17c-b8609579a8e4	Người dùng ẩn danh	005725f5-42ed-4df5-8aef-7f22ca08a93c	4000	t	2025-12-03 12:01:17.586	Người dùng ẩn danh
4ceb578b-9939-4b1d-ab34-4ccfdd2e6606	59ca659c-60c1-70d7-23dd-3a26a0c5df58	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	f	2025-12-03 13:42:06.641	Du Vân
94823ad3-afb5-45ab-8a22-796dc24be454	59ca659c-60c1-70d7-23dd-3a26a0c5df58	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	f	2025-12-03 13:50:12.134	Du Vân
19c454eb-fae4-4f75-8ef8-a824a9797779	Người dùng ẩn danh	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	t	2025-12-03 11:25:21.106	Người dùng ẩn danh
e58a21a1-d5bb-4c2a-a4d9-8754bf39941f	59ca659c-60c1-70d7-23dd-3a26a0c5df58	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	f	2025-12-03 15:53:57.813	Du Vân
8363cff1-6085-4a13-8832-e68188b89ab9	793a75fc-40a1-70e2-9d09-9a0f86a6f48f	14ad34dc-dc0c-42f8-868c-237fe766ca9a	100000	f	2025-12-04 04:09:30.381	Duy
f9659da8-f404-4bd7-8a0b-89860081dfee	Người dùng ẩn danh	cc29b597-e75e-4a62-8258-5b1fced63534	500000	t	2025-12-04 04:48:00.482	Người dùng ẩn danh
f46ba51b-890a-45f5-b380-78303ef5846a	c9ea352c-00d1-706a-26f3-236361e805d4	005725f5-42ed-4df5-8aef-7f22ca08a93c	2000	t	2025-12-04 06:18:01.281	Người dùng ẩn danh
225077b7-5714-4b71-8a01-235a85b7c7de	19eaa51c-5061-7097-52d0-fa60f6db38e1	84a8f4d0-127d-4283-adaa-0b6a65af65e0	2000	f	2025-12-10 07:28:04.68	Luyện Fundraiser
\.


--
-- TOC entry 4797 (class 0 OID 61675)
-- Dependencies: 231
-- Data for Name: notifications_2025_11; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.notifications_2025_11 (id, user_id, actor_id, type, entity_type, entity_id, data, is_read, created_at, updated_at) FROM stdin;
fbb74c0c-e9db-4479-8c1e-ac1e42f5c9b7	897a759c-b0f1-70b9-516c-ee61af672c56	093ab54c-70f1-7008-1d8d-05adf6fc8748	POST_REPLY	COMMENT	da5a02e3-ad74-43b7-b3fd-3175968ae8ac	{"title": "💬 New Reply", "postId": "4ccbf109-3b06-44e4-b36c-9bb01f488fb9", "message": "Huỳnh Đình Luyện replied to your comment: \\"chúc cơn bão sớm lướt qua\\"", "commentId": "da5a02e3-ad74-43b7-b3fd-3175968ae8ac", "postTitle": "Vậy là hôm nay đã bắt đầu rồi", "queueJobId": "comment-reply-da5a02e3-ad74-43b7-b3fd-3175968ae8ac", "processedAt": "2025-11-22T14:44:44.221Z", "replierName": "Huỳnh Đình Luyện", "replyPreview": "chúc cơn bão sớm lướt qua", "parentCommentId": "e4c6b762-5906-4862-82aa-d27893b52ed3"}	f	2025-11-22 14:44:44.226+00	2025-11-22 14:44:44.226+00
0434d018-7f45-4b3a-a5a8-122835fc7ca3	d96ae52c-1031-70ec-91a7-8a77026ec88c	093ab54c-70f1-7008-1d8d-05adf6fc8748	POST_COMMENT	COMMENT	7bfd5f17-be32-4fb7-b5c7-7c7372497c4b	{"title": "💬 New Comment", "postId": "4ccbf109-3b06-44e4-b36c-9bb01f488fb9", "message": "Huỳnh Đình Luyện commented on \\"Vậy là hôm nay đã bắt đầu rồi\\": \\"bữa cơm thật ý nghĩa\\"", "commentId": "7bfd5f17-be32-4fb7-b5c7-7c7372497c4b", "postTitle": "Vậy là hôm nay đã bắt đầu rồi", "queueJobId": "post-comment-7bfd5f17-be32-4fb7-b5c7-7c7372497c4b", "processedAt": "2025-11-22T14:49:22.837Z", "commenterName": "Huỳnh Đình Luyện", "commentPreview": "bữa cơm thật ý nghĩa"}	f	2025-11-22 14:49:22.885+00	2025-11-22 14:49:22.885+00
1340492b-b8d9-4add-a239-7f8146494152	d96ae52c-1031-70ec-91a7-8a77026ec88c	093ab54c-70f1-7008-1d8d-05adf6fc8748	POST_LIKE	POST	4ccbf109-3b06-44e4-b36c-9bb01f488fb9	{"title": "❤️ Post Liked", "postId": "4ccbf109-3b06-44e4-b36c-9bb01f488fb9", "message": "Huỳnh Đình Luyện và 2 người khác thích bài viết của bạn \\"Vậy là hôm nay đã bắt đầu rồi\\"", "likeCount": 3, "postTitle": "Vậy là hôm nay đã bắt đầu rồi", "queueJobId": "post-like-4ccbf109-3b06-44e4-b36c-9bb01f488fb9", "processedAt": "2025-11-22T14:55:54.464Z", "latestLikerName": "Huỳnh Đình Luyện"}	f	2025-11-22 14:48:45.067+00	2025-11-22 14:55:54.483+00
880c2acd-f0b7-48ee-9626-160a867229d2	d96ae52c-1031-70ec-91a7-8a77026ec88c	093ab54c-70f1-7008-1d8d-05adf6fc8748	POST_COMMENT	COMMENT	46429885-5334-400b-a48f-7e046e6e306a	{"title": "💬 New Comment", "postId": "4ccbf109-3b06-44e4-b36c-9bb01f488fb9", "message": "Huỳnh Đình Luyện commented on \\"Vậy là hôm nay đã bắt đầu rồi\\": \\"haha\\"", "commentId": "46429885-5334-400b-a48f-7e046e6e306a", "postTitle": "Vậy là hôm nay đã bắt đầu rồi", "queueJobId": "post-comment-46429885-5334-400b-a48f-7e046e6e306a", "processedAt": "2025-11-22T14:56:39.472Z", "commenterName": "Huỳnh Đình Luyện", "commentPreview": "haha"}	f	2025-11-22 14:56:39.501+00	2025-11-22 14:56:39.501+00
0dd79c29-4467-4f60-8ad3-f96387623579	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	CAMPAIGN_CANCELLED	CAMPAIGN	f0c6c3ff-94f1-4acf-bf48-16118ab413bb	{"title": "🚫 Campaign Cancelled", "reason": "dính drama", "message": "Campaign \\"Chương trình Suất Ăn Miễn Phí Tháng 11\\" has been cancelled. Reason: dính drama", "campaignId": "f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "queueJobId": "campaign-cancelled-f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "processedAt": "2025-11-27T09:40:29.659Z", "campaignTitle": "Chương trình Suất Ăn Miễn Phí Tháng 11"}	t	2025-11-27 09:40:29.702+00	2025-12-02 14:31:39.525+00
\.


--
-- TOC entry 4798 (class 0 OID 61689)
-- Dependencies: 232
-- Data for Name: notifications_2025_12; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.notifications_2025_12 (id, user_id, actor_id, type, entity_type, entity_id, data, is_read, created_at, updated_at) FROM stdin;
4ca5cae2-e885-4edd-ab69-638fbab44ede	d96ae52c-1031-70ec-91a7-8a77026ec88c	f9aa955c-4051-709c-4ffc-005fd148ef48	CAMPAIGN_REJECTED	CAMPAIGN	5eeaae10-d8c2-43ad-b405-32e5e453dfc8	{"title": "❌ Campaign Rejected", "reason": "tại thích từ chối", "message": "Your campaign \\"Đông ấm 2025 - Lửa hồng biên cương\\" was rejected. Reason: tại thích từ chối", "campaignId": "5eeaae10-d8c2-43ad-b405-32e5e453dfc8", "queueJobId": "campaign-rejected-5eeaae10-d8c2-43ad-b405-32e5e453dfc8", "rejectedBy": "f9aa955c-4051-709c-4ffc-005fd148ef48", "processedAt": "2025-12-01T14:11:58.949Z", "campaignTitle": "Đông ấm 2025 - Lửa hồng biên cương"}	f	2025-12-01 14:11:58.983+00	2025-12-01 14:11:58.983+00
f1c72ca3-713a-4b3f-90e8-fdd6593ef904	d96ae52c-1031-70ec-91a7-8a77026ec88c	\N	CAMPAIGN_CANCELLED	CAMPAIGN	005725f5-42ed-4df5-8aef-7f22ca08a93c	{"title": "🚫 Campaign Cancelled", "reason": "Dính drama", "message": "Campaign \\"CẦN LẮM NHỮNG BỮA CƠM CÓ THỊT CHO TRẺ EM NGHÈO\\" has been cancelled. Reason: Dính drama", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "queueJobId": "campaign-cancelled-005725f5-42ed-4df5-8aef-7f22ca08a93c", "processedAt": "2025-12-02T18:33:42.437Z", "campaignTitle": "CẦN LẮM NHỮNG BỮA CƠM CÓ THỊT CHO TRẺ EM NGHÈO"}	f	2025-12-02 18:33:42.446+00	2025-12-02 18:33:42.446+00
a2eb828c-aa09-4245-b659-b249f08e7b4f	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	SURPLUS_TRANSFERRED	WALLET	5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2	{"title": "Tiền dư đã được chuyển vào ví", "message": "Tiền dư từ yêu cầu nguyên liệu đã được chuyển vào ví của bạn. Chiến dịch: \\"Chương trình Suất ăn miễn phí định kỳ...\\" - Giai đoạn: \\"Bệnh viện A\\". Ngân sách: 17,000 VND, Chi phí thực tế: 16,000 VND, Tiền dư: 1,000 VND.", "phaseName": "Bệnh viện A", "requestId": "5e6ca4a0-e5e5-42f1-b8f4-57783274b4a2", "actualCost": "16000", "requestType": "INGREDIENT", "campaignTitle": "Chương trình Suất ăn miễn phí định kỳ - Hỗ trợ bệnh nhân", "surplusAmount": "1000", "originalBudget": "17000", "walletTransactionId": "e95b2b96-fa48-4395-aa7f-8cfa36cf92e3"}	f	2025-12-05 09:48:33.409+00	2025-12-05 09:48:33.409+00
f24c9974-b570-4aec-a0e1-2b016fa660f2	d96ae52c-1031-70ec-91a7-8a77026ec88c	19eaa51c-5061-7097-52d0-fa60f6db38e1	POST_LIKE	POST	0cf0082d-185d-4050-9009-fd7485cbebb4	{"title": "Post Liked", "postId": "0cf0082d-185d-4050-9009-fd7485cbebb4", "message": "Luyện Fundraiser và 2 người khác thích bài viết của bạn \\"Video\\"", "likeCount": 3, "postTitle": "Video", "queueJobId": "post-like-0cf0082d-185d-4050-9009-fd7485cbebb4", "processedAt": "2025-12-07T03:45:10.394Z", "latestLikerName": "Luyện Fundraiser"}	f	2025-12-07 03:45:10.419+00	2025-12-07 03:45:10.419+00
ef58343a-154c-4b0a-8b16-4c9d832da7cf	c9ea352c-00d1-706a-26f3-236361e805d4	\N	CAMPAIGN_CANCELLED	CAMPAIGN	a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961	{"title": "🚫 Campaign Cancelled", "reason": "Dính drama", "message": "Campaign \\"Hỗ trợ sinh viên Chu Văn An\\" has been cancelled. Reason: Dính drama", "campaignId": "a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961", "queueJobId": "campaign-cancelled-a0b09a4b-c4c7-46ea-82f5-3c36ffbf6961", "processedAt": "2025-12-07T07:05:36.185Z", "campaignTitle": "Hỗ trợ sinh viên Chu Văn An"}	f	2025-12-07 07:05:36.21+00	2025-12-07 07:05:36.21+00
ccc2a9e2-37c2-4a42-bf4f-7cf77d4132fa	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	SURPLUS_TRANSFERRED	WALLET	c720cc2e-3617-49b2-b451-714a3b13a86e	{"title": "Tiền dư đã được chuyển vào ví", "message": "Tiền dư từ yêu cầu nguyên liệu đã được chuyển vào ví của bạn. Chiến dịch: \\"Chương trình Suất ăn miễn phí cho Đìn...\\" - Giai đoạn: \\"Công viên B5\\". Ngân sách: 14,000 VND, Chi phí thực tế: 10,000 VND, Tiền dư: 4,000 VND.", "phaseName": "Công viên B5", "requestId": "c720cc2e-3617-49b2-b451-714a3b13a86e", "actualCost": "10000", "requestType": "INGREDIENT", "campaignTitle": "Chương trình Suất ăn miễn phí cho Đình Luyện", "surplusAmount": "4000", "originalBudget": "14000", "walletTransactionId": "35a9f8c3-0783-43c8-91a7-dbcc94b8a393"}	f	2025-12-07 08:24:24.775+00	2025-12-07 08:24:24.775+00
859de8e9-8619-43fd-90ed-664d732e05e2	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	SURPLUS_TRANSFERRED	WALLET	c720cc2e-3617-49b2-b451-714a3b13a86e	{"title": "Tiền dư đã được chuyển vào ví", "message": "Tiền dư từ yêu cầu nguyên liệu đã được chuyển vào ví của bạn. Chiến dịch: \\"Chương trình Suất ăn miễn phí cho Đìn...\\" - Giai đoạn: \\"Công viên B5\\". Ngân sách: 14,000 VND, Chi phí thực tế: 10,000 VND, Tiền dư: 4,000 VND.", "phaseName": "Công viên B5", "requestId": "c720cc2e-3617-49b2-b451-714a3b13a86e", "actualCost": "10000", "requestType": "INGREDIENT", "campaignTitle": "Chương trình Suất ăn miễn phí cho Đình Luyện", "surplusAmount": "4000", "originalBudget": "14000", "walletTransactionId": "47e55a80-02ab-434f-a197-e95cfbbc2eff"}	f	2025-12-07 10:12:32.215+00	2025-12-07 10:12:32.215+00
0e9f3e70-55c8-4824-a393-cdefc5cfe75e	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	SURPLUS_TRANSFERRED	WALLET	c720cc2e-3617-49b2-b451-714a3b13a86e	{"title": "Tiền dư đã được chuyển vào ví", "message": "Tiền dư từ yêu cầu nguyên liệu đã được chuyển vào ví của bạn. Chiến dịch: \\"Chương trình Suất ăn miễn phí cho Đìn...\\" - Giai đoạn: \\"Công viên B5\\". Ngân sách: 14,000 VND, Chi phí thực tế: 10,000 VND, Tiền dư: 4,000 VND.", "phaseName": "Công viên B5", "requestId": "c720cc2e-3617-49b2-b451-714a3b13a86e", "actualCost": "10000", "requestType": "INGREDIENT", "campaignTitle": "Chương trình Suất ăn miễn phí cho Đình Luyện", "surplusAmount": "4000", "originalBudget": "14000", "walletTransactionId": "ae512ce9-c1f8-46d3-bd36-0c34f1a6ecfe"}	f	2025-12-08 04:22:07.974+00	2025-12-08 04:22:07.974+00
6d32cc79-8a3f-4753-8496-3e08e24720af	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	SURPLUS_TRANSFERRED	WALLET	c720cc2e-3617-49b2-b451-714a3b13a86e	{"title": "Tiền dư đã được chuyển vào ví", "message": "Tiền dư từ yêu cầu nguyên liệu đã được chuyển vào ví của bạn. Chiến dịch: \\"Chương trình Suất ăn miễn phí cho Đìn...\\" - Giai đoạn: \\"Công viên B5\\". Ngân sách: 14,000 VND, Chi phí thực tế: 10,000 VND, Tiền dư: 4,000 VND.", "phaseName": "Công viên B5", "requestId": "c720cc2e-3617-49b2-b451-714a3b13a86e", "actualCost": "10000", "requestType": "INGREDIENT", "campaignTitle": "Chương trình Suất ăn miễn phí cho Đình Luyện", "surplusAmount": "4000", "originalBudget": "14000", "walletTransactionId": "fca99aaa-a1a5-440c-bfcd-35684ac3d173"}	f	2025-12-09 06:09:19.953+00	2025-12-09 06:09:19.953+00
edb2789d-24f6-4f75-8593-4ed76af64361	19eaa51c-5061-7097-52d0-fa60f6db38e1	\N	SURPLUS_TRANSFERRED	WALLET	8fad6a7d-ef35-4cef-b2b8-c34f1b989a75	{"title": "Tiền dư đã được chuyển vào ví", "message": "Tiền dư từ yêu cầu nguyên liệu đã được chuyển vào ví của bạn. Chiến dịch: \\"Góp Gạo Nuôi Bé\\" - Giai đoạn: \\"Khu ổ chuột A\\". Ngân sách: 12,800 VND, Chi phí thực tế: 12,500 VND, Tiền dư: 300 VND.", "phaseName": "Khu ổ chuột A", "requestId": "8fad6a7d-ef35-4cef-b2b8-c34f1b989a75", "actualCost": "12500", "requestType": "INGREDIENT", "campaignTitle": "Góp Gạo Nuôi Bé", "surplusAmount": "300", "originalBudget": "12800", "walletTransactionId": "6b4a0f96-92b3-444f-8942-7d8bfed94c91"}	f	2025-12-09 15:20:58.366+00	2025-12-09 15:20:58.366+00
\.


--
-- TOC entry 4799 (class 0 OID 61703)
-- Dependencies: 233
-- Data for Name: notifications_2026_01; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.notifications_2026_01 (id, user_id, actor_id, type, entity_type, entity_id, data, is_read, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4801 (class 0 OID 80549)
-- Dependencies: 238
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.outbox_events (id, aggregate_id, event_type, payload, status, retry_count, created_at, processed_at, error_log) FROM stdin;
908966e4-63bf-483f-8806-f3bb245ca180	1764336284798392	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "897a759c-b0f1-70b9-516c-ee61af672c56", "gateway": "PAYOS", "donorName": "Minh Phuoc Feda", "orderCode": "1764336284798392", "campaignId": "7ea264fc-368c-4819-acc4-9b77d194c427", "paymentTransactionId": "0f62a201-2ab8-404d-a03c-413286c9bc44"}	COMPLETED	0	2025-11-28 13:25:20.752	2025-11-28 13:25:34.168	\N
9ffe9278-9ad8-4471-b430-9bf62464dfd7	1764337027524122	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "897a759c-b0f1-70b9-516c-ee61af672c56", "gateway": "PAYOS", "donorName": "Minh Phuoc Feda", "orderCode": "1764337027524122", "campaignId": "7ea264fc-368c-4819-acc4-9b77d194c427", "paymentTransactionId": "999bf7b8-ceeb-441e-95cf-427e85c0a2bf"}	COMPLETED	0	2025-11-28 13:37:51.287	2025-11-28 13:38:03.088	\N
d2c8ff77-065a-4595-9749-8b37d706ce40	1764337323343541	DONATION_PAYMENT_SUCCEEDED	{"amount": "3000", "donorId": "897a759c-b0f1-70b9-516c-ee61af672c56", "gateway": "SEPAY", "donorName": "Minh Phuoc Feda", "orderCode": "1764337323343541", "campaignId": "7ea264fc-368c-4819-acc4-9b77d194c427", "paymentTransactionId": "9f96dccc-e3f3-4020-8f3e-9ad3b4a31c4c"}	COMPLETED	0	2025-11-28 13:43:23.233	2025-11-28 13:43:34.804	\N
5bc628d8-ddcc-478a-b024-467a3cd4ca31	1764337914477340	DONATION_PAYMENT_SUCCEEDED	{"amount": "20000", "donorId": "897a759c-b0f1-70b9-516c-ee61af672c56", "gateway": "PAYOS", "donorName": "Minh Phuoc Feda", "orderCode": "1764337914477340", "campaignId": "7ea264fc-368c-4819-acc4-9b77d194c427", "paymentTransactionId": "2b45b0a8-39f7-49aa-b152-3066fd3c549f"}	COMPLETED	0	2025-11-28 13:53:04.394	2025-11-28 13:53:21.192	\N
fc373620-4bdc-43f2-bce6-3e028661117f	1764338493335538	DONATION_PAYMENT_SUCCEEDED	{"amount": "15000", "donorId": "897a759c-b0f1-70b9-516c-ee61af672c56", "gateway": "PAYOS", "donorName": "Minh Phuoc Feda", "orderCode": "1764338493335538", "campaignId": "89df7844-1335-44dd-8ccc-3a707ad6179d", "paymentTransactionId": "2c3fc91d-33d1-451f-ab6f-7aa6ed1d72ba"}	COMPLETED	0	2025-11-28 14:18:26.964	2025-11-28 14:18:41.596	\N
372219d0-4509-4ed9-a654-8cd2332bcd29	1764339781481244	DONATION_PAYMENT_SUCCEEDED	{"amount": "30000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764339781481244", "campaignId": "f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "paymentTransactionId": "d0b44f82-77e8-4e3f-8c0f-413d707145e2"}	COMPLETED	0	2025-11-28 14:29:36.789	2025-11-28 14:29:58.991	\N
3db5a81a-cb01-486f-b016-704899b9a8f6	1764339781481244	DONATION_PAYMENT_SUCCEEDED	{"amount": "30000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764339781481244", "campaignId": "f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "paymentTransactionId": "d0b44f82-77e8-4e3f-8c0f-413d707145e2"}	COMPLETED	0	2025-11-28 14:29:40.078	2025-11-28 14:30:12.169	\N
64172f93-b11f-4809-aaba-098de5f10880	1764341117101469	DONATION_PAYMENT_SUCCEEDED	{"amount": "30000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764341117101469", "campaignId": "f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "paymentTransactionId": "2c68b101-aae2-4ba4-ad51-77f22ff04f7a"}	COMPLETED	0	2025-11-28 14:47:27.288	2025-11-28 14:47:34.867	\N
d2ab7cd4-97f2-4d61-a1a7-1a8e880405e9	1764342318765295	DONATION_PAYMENT_SUCCEEDED	{"amount": "30000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764342318765295", "campaignId": "f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "paymentTransactionId": "49a8671e-9b8d-48b4-b98d-c4d0f09d258a"}	COMPLETED	0	2025-11-28 15:06:36.053	2025-11-28 15:06:43.896	\N
2484f120-b3e8-4552-a25b-d8a32dceb8f7	f0c6c3ff-94f1-4acf-bf48-16118ab413bb	CAMPAIGN_SURPLUS_SETTLED	{"surplus": "10000", "timestamp": "2025-11-28T15:06:44.953Z", "campaignId": "f0c6c3ff-94f1-4acf-bf48-16118ab413bb", "fundraiserId": "019ac55c-0903-7685-b3cf-abee461fcd6b", "settlementId": "a9fb8362-71a7-423a-aacb-bbe68888f504", "campaignTitle": "Chương trình Suất Ăn Miễn Phí Tháng 11======DATA TEST"}	COMPLETED	0	2025-11-28 15:06:44.955	2025-11-28 15:06:50.964	\N
6a0d42d4-b165-4cef-99ac-7cfe699ac33e	1764342734119701	DONATION_PAYMENT_SUCCEEDED	{"amount": "60000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764342734119701", "campaignId": "b133c483-5a78-48c6-b1c3-e72b34f9e740", "paymentTransactionId": "dcebc12a-9991-4308-a298-ac38cb1383bb"}	COMPLETED	0	2025-11-28 15:13:15.261	2025-11-28 15:13:24.377	\N
6840936c-aa64-4da2-8794-c2c23d7842b6	b133c483-5a78-48c6-b1c3-e72b34f9e740	CAMPAIGN_SURPLUS_SETTLED	{"surplus": "10000", "timestamp": "2025-11-28T15:13:25.454Z", "campaignId": "b133c483-5a78-48c6-b1c3-e72b34f9e740", "fundraiserId": "0199e599-5573-754a-9572-fdf8e68ae301", "settlementId": "f980f6e4-02c2-4e97-ba2c-ca1ab13f5541", "campaignTitle": "Kêu gọi ủng hộ Chương trình \\"Góp gạo - Thổi cơm cho người kh"}	COMPLETED	0	2025-11-28 15:13:25.455	2025-11-28 15:13:31.642	\N
f0498450-0763-4925-bbc1-b67b1512204b	1764343505833160	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "d96ae52c-1031-70ec-91a7-8a77026ec88c", "gateway": "PAYOS", "donorName": "Huỳnh Lê Nhật Hoàng", "orderCode": "1764343505833160", "campaignId": "d6cb8550-74f4-4769-84d3-b00b1f38337e", "paymentTransactionId": "19f8c0b5-11c5-44ab-98ad-3f3c21ddeb57"}	COMPLETED	0	2025-11-28 15:25:38.461	2025-11-28 15:25:47.695	\N
16d97417-0797-46e7-9fa8-fde103f73dfb	1764492295009511	DONATION_PAYMENT_SUCCEEDED	{"amount": "5000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764492295009511", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "3847e4ad-7432-4e40-9162-8a65e29bbb40"}	COMPLETED	0	2025-11-30 11:17:37.216	2025-11-30 11:17:42.61	\N
1b84428c-9649-43cd-8c16-b864b61cef0b	eee98b1b-4035-4cc7-8668-1932154eaa37	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "SUPPLEMENTARY", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "eee98b1b-4035-4cc7-8668-1932154eaa37"}	PROCESSING	1	2025-11-30 11:30:33.199	\N	Cannot convert SUPPLEMENTARY to a BigInt
eb2ec2d5-1911-4e9b-94f5-8278327f7dae	33ae2305-46da-4fcd-901d-354b39c0af0d	DONATION_PAYMENT_SUCCEEDED	{"amount": "3000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "SUPPLEMENTARY", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "33ae2305-46da-4fcd-901d-354b39c0af0d"}	PROCESSING	2	2025-11-30 11:42:30.245	\N	Cannot convert SUPPLEMENTARY to a BigInt
261bd7f7-9434-4e76-a81f-74280287ea7d	1764503549518168	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764503549518168", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "b17896d0-8f75-4d5f-b18f-1043330e4893"}	COMPLETED	0	2025-11-30 11:53:07.191	2025-11-30 11:53:11.66	\N
7c3aad07-a837-4fbf-bfbc-fa51af9a6dc7	fc88b407-13ee-4df3-b499-54df300f8461	DONATION_PAYMENT_SUCCEEDED	{"amount": "3000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "SUPPLEMENTARY", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "fc88b407-13ee-4df3-b499-54df300f8461"}	COMPLETED	0	2025-11-30 12:12:23.344	2025-11-30 12:12:27.075	\N
2a9daaeb-7722-4538-b7a9-8e7307dab428	1764504798194634	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "1764504798194634", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "f8d9ff4f-ab4f-4ca7-999f-9eec30f0ec9c"}	COMPLETED	0	2025-11-30 12:13:59.846	2025-11-30 12:14:01.99	\N
d02f98eb-56c3-4003-ba2e-b68a50df8a8f	948710f8-f47d-40dc-b286-cb48546f7208	DONATION_PAYMENT_SUCCEEDED	{"amount": "6000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "SUPPLEMENTARY", "campaignId": "5ff6833f-1cbe-4c8d-add0-c83d0365dfa4", "paymentTransactionId": "948710f8-f47d-40dc-b286-cb48546f7208"}	COMPLETED	0	2025-11-30 12:15:11.478	2025-11-30 12:15:17.694	\N
85efd5e2-add3-4344-a916-e85e9606404f	1764693766302580	DONATION_PAYMENT_SUCCEEDED	{"amount": "200000", "donorId": "696a959c-c031-701c-085a-ff780e5b0f07", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "1764693766302580", "campaignId": "6114ee01-0a44-44f9-a7ee-e23e2a9f7575", "paymentTransactionId": "4773a30a-91ee-4294-9c6e-a0468a013423"}	COMPLETED	0	2025-12-02 16:43:08.439	2025-12-02 16:43:10.803	\N
637c574a-ac7d-4bee-8656-82243e4def82	1764761122654414	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764761122654414", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "c9025bc0-0a90-4646-b817-e9926c16e4d0"}	COMPLETED	0	2025-12-03 11:29:05.165	2025-12-03 11:29:13.319	\N
01e72219-b6f7-4280-aae8-9ebdd9927f15	aacd5c0c-7ec6-4a85-8277-aa3edb7d19bc	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "SUPPLEMENTARY", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "aacd5c0c-7ec6-4a85-8277-aa3edb7d19bc"}	COMPLETED	0	2025-12-03 11:29:06.077	2025-12-03 11:29:14.155	\N
18aa53d4-c168-42d6-9dbe-be282fb37f3f	1764761976102683	DONATION_PAYMENT_SUCCEEDED	{"amount": "3000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "1764761976102683", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "0d815d0c-07c6-4dc8-989b-4a1c8ad28e4f"}	COMPLETED	0	2025-12-03 11:42:15.96	2025-12-03 11:42:15.202	\N
e9e6e002-6a4c-46b3-9f01-0dd6756753af	1764761976102683	DONATION_PAYMENT_SUCCEEDED	{"amount": "3000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764761976102683", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "0d815d0c-07c6-4dc8-989b-4a1c8ad28e4f"}	COMPLETED	0	2025-12-03 11:42:15.041	2025-12-03 11:42:18.709	\N
4ee81ac0-bc83-4ac5-8744-902f4d3514aa	1764763278844666	DONATION_PAYMENT_SUCCEEDED	{"amount": "4000", "donorId": "Người dùng ẩn danh", "gateway": "PAYOS", "donorName": "Người dùng ẩn danh", "orderCode": "1764763278844666", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "cf085fe4-8be8-4b3c-aa37-4db8b071babb"}	COMPLETED	0	2025-12-03 12:01:55.335	2025-12-03 12:01:55.163	\N
11d29b36-94a8-45ee-91e0-2815e3e7454f	1764763278844666	DONATION_PAYMENT_SUCCEEDED	{"amount": "4000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "1764763278844666", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "cf085fe4-8be8-4b3c-aa37-4db8b071babb"}	COMPLETED	0	2025-12-03 12:01:57.194	2025-12-03 12:02:02.249	\N
23698cc5-19ba-46d4-be24-768487a94168	1764769326700969	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "59ca659c-60c1-70d7-23dd-3a26a0c5df58", "gateway": "PAYOS", "donorName": "Du Vân", "orderCode": "1764769326700969", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "f57327e8-550a-4983-859e-5518a8950304"}	COMPLETED	0	2025-12-03 13:42:39.5	2025-12-03 13:42:41.385	\N
d17059e8-1b5d-4401-8561-a367adfe4244	1764769812156863	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "59ca659c-60c1-70d7-23dd-3a26a0c5df58", "gateway": "PAYOS", "donorName": "Du Vân", "orderCode": "1764769812156863", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "9439d646-6de1-4dd9-9b66-97ab1889a115"}	COMPLETED	0	2025-12-03 13:50:41.008	2025-12-03 13:50:51.009	\N
e417e720-904a-4989-82b3-a5189a83662b	1764777237835498	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "59ca659c-60c1-70d7-23dd-3a26a0c5df58", "gateway": "SEPAY", "donorName": "Du Vân", "orderCode": "1764777237835498", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "f5805e77-69b7-4f39-9da6-9063ba59313f"}	COMPLETED	0	2025-12-03 15:54:28.237	2025-12-03 15:54:37.015	\N
92f53ea0-65e2-4409-9b30-835c1f6252d0	1764821370502467	DONATION_PAYMENT_SUCCEEDED	{"amount": "100000", "donorId": "793a75fc-40a1-70e2-9d09-9a0f86a6f48f", "gateway": "PAYOS", "donorName": "Duy", "orderCode": "1764821370502467", "campaignId": "14ad34dc-dc0c-42f8-868c-237fe766ca9a", "paymentTransactionId": "bf2668f3-4d9e-4624-8a7a-6d8d66767f7e"}	COMPLETED	0	2025-12-04 04:09:47.761	2025-12-04 04:09:53.888	\N
1c5c8a80-1c07-49e8-80b3-2ec6778150ac	1764823680515907	DONATION_PAYMENT_SUCCEEDED	{"amount": "500000", "donorId": "Người dùng ẩn danh", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "1764823680515907", "campaignId": "cc29b597-e75e-4a62-8258-5b1fced63534", "paymentTransactionId": "1aa4c241-2eef-43eb-8b57-169ec2c8acf0"}	COMPLETED	0	2025-12-04 04:48:21.574	2025-12-04 04:48:26.79	\N
8bb5481e-fc38-40f3-a861-6c7beea7d61f	cc29b597-e75e-4a62-8258-5b1fced63534	CAMPAIGN_SURPLUS_SETTLED	{"surplus": "280000", "timestamp": "2025-12-04T04:48:27.326Z", "campaignId": "cc29b597-e75e-4a62-8258-5b1fced63534", "fundraiserId": "019a481a-612a-74e1-aa1d-764e11f0c593", "settlementId": "3278fa42-f725-4030-a166-bdc64dbac497", "campaignTitle": "Quỹ nấu cơm hằng tuần"}	COMPLETED	0	2025-12-04 04:48:27.328	2025-12-04 04:48:30.514	\N
98ac076b-f2c1-4885-abc0-4925e7c981b5	1764829081351836	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "c9ea352c-00d1-706a-26f3-236361e805d4", "gateway": "SEPAY", "donorName": "Người dùng ẩn danh", "orderCode": "1764829081351836", "campaignId": "005725f5-42ed-4df5-8aef-7f22ca08a93c", "paymentTransactionId": "019fd51e-423a-4e30-8731-a5ec89b176c9"}	COMPLETED	0	2025-12-04 06:18:22.233	2025-12-04 06:18:28.281	\N
ce7b7428-57fe-4725-94c3-0b532da524ab	1765351684732110	DONATION_PAYMENT_SUCCEEDED	{"amount": "2000", "donorId": "19eaa51c-5061-7097-52d0-fa60f6db38e1", "gateway": "PAYOS", "donorName": "Luyện Fundraiser", "orderCode": "1765351684732110", "campaignId": "84a8f4d0-127d-4283-adaa-0b6a65af65e0", "paymentTransactionId": "4fc1862e-6c9c-4727-a811-ffe9fa548878"}	COMPLETED	0	2025-12-10 07:29:05.607	2025-12-10 07:29:11.577	\N
\.


--
-- TOC entry 4792 (class 0 OID 21771)
-- Dependencies: 225
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.payment_transactions (id, donation_id, currency, status, created_at, updated_at, refunded_at, error_code, error_description, order_code, amount, description, gateway, processed_by_webhook, received_amount, payment_status, payos_metadata, sepay_metadata) FROM stdin;
f57327e8-550a-4983-859e-5518a8950304	4ceb578b-9939-4b1d-ab34-4ccfdd2e6606	VND	SUCCESS	2025-12-03 13:42:07.797	2025-12-03 13:42:39.47	\N	\N	\N	1764769326700969	2000	CSKYZVPJNP2 1764769326700969	PAYOS	t	2000	COMPLETED	{"reference": "4133", "counter_account_name": null, "transaction_datetime": "2025-12-03T20:42:34.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": null, "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": ""}	\N
bf2668f3-4d9e-4624-8a7a-6d8d66767f7e	8363cff1-6085-4a13-8832-e68188b89ab9	VND	SUCCESS	2025-12-04 04:09:30.955	2025-12-04 04:09:47.732	\N	\N	\N	1764821370502467	100000	CS4E6SL6K36 1764821370502467	PAYOS	t	100000	COMPLETED	{"reference": "4136", "counter_account_name": "MOMOIBFT", "transaction_datetime": "2025-12-04T11:09:47.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": "0697044105922", "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": "TMCP Ban Viet"}	\N
9439d646-6de1-4dd9-9b66-97ab1889a115	94823ad3-afb5-45ab-8a22-796dc24be454	VND	SUCCESS	2025-12-03 13:50:12.568	2025-12-03 13:50:40.928	\N	\N	\N	1764769812156863	2000	CS7N0BXN517 1764769812156863	PAYOS	t	2000	COMPLETED	{"reference": "4134", "counter_account_name": null, "transaction_datetime": "2025-12-03T20:50:36.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": null, "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": ""}	\N
1aa4c241-2eef-43eb-8b57-169ec2c8acf0	f9659da8-f404-4bd7-8a0b-89860081dfee	VND	SUCCESS	2025-12-04 04:48:01.052	2025-12-04 04:48:21.526	\N	\N	\N	1764823680515907	500000	CSJM3FMP3P2 1764823680515907	SEPAY	t	500000	COMPLETED	{"qr_code": "00020101021238600010A000000727013000069704160116LOCCASS0003339510208QRIBFTTA530370454065000005802VN62320828CSJM3FMP3P2 17648236805159076304064B", "checkout_url": "https://pay.payos.vn/web/ab8352186da24593b9a01d5c569feb32", "payment_link_id": "ab8352186da24593b9a01d5c569feb32"}	{"content": "CSJM3FMP3P2 1764823680515907 GD 5338IBT1hWCTUIL3 041225-11:48:20", "sepay_id": 33830201, "bank_name": "ACB", "accumulated": 0, "description": "BankAPINotify CSJM3FMP3P2 1764823680515907 GD 5338IBT1hWCTUIL3 041225-11:48:20", "sub_account": null, "reference_code": "4138", "transaction_date": "2025-12-04 11:48:21"}
f5805e77-69b7-4f39-9da6-9063ba59313f	e58a21a1-d5bb-4c2a-a4d9-8754bf39941f	VND	SUCCESS	2025-12-03 15:53:58.343	2025-12-03 15:54:28.177	\N	\N	\N	1764777237835498	2000	109545731033-0938848615-CSZQBPPJCL0 1764777237835498	SEPAY	t	2000	COMPLETED	{"qr_code": "00020101021238600010A000000727013000069704160116LOCCASS0003339510208QRIBFTTA5303704540420005802VN62320828CSZQBPPJCL0 1764777237835498630437A1", "checkout_url": "https://pay.payos.vn/web/8a3769c0258746f6838d7a5a31714a78", "payment_link_id": "8a3769c0258746f6838d7a5a31714a78"}	{"content": "109545731033-0938848615-CSZQBPPJCL0 1764777237835498", "sepay_id": 33772291, "bank_name": "ACB", "accumulated": 0, "description": "BankAPINotify 109545731033-0938848615-CSZQBPPJCL0 1764777237835498", "sub_account": null, "reference_code": "4135", "transaction_date": "2025-12-03 22:54:23"}
019fd51e-423a-4e30-8731-a5ec89b176c9	f46ba51b-890a-45f5-b380-78303ef5846a	VND	SUCCESS	2025-12-04 06:18:02.253	2025-12-04 06:18:22.166	\N	\N	\N	1764829081351836	2000	109608560361-0938848615-CSGNX74Z4V3 1764829081351836	SEPAY	t	2000	COMPLETED	{"qr_code": "00020101021238600010A000000727013000069704160116LOCCASS0003339510208QRIBFTTA5303704540420005802VN62320828CSGNX74Z4V3 1764829081351836630477FC", "checkout_url": "https://pay.payos.vn/web/9435f8d131b84e19b494047a53e68ade", "payment_link_id": "9435f8d131b84e19b494047a53e68ade"}	{"content": "109608560361-0938848615-CSGNX74Z4V3 1764829081351836", "sepay_id": 33841690, "bank_name": "ACB", "accumulated": 0, "description": "BankAPINotify 109608560361-0938848615-CSGNX74Z4V3 1764829081351836", "sub_account": null, "reference_code": "4140", "transaction_date": "2025-12-04 13:18:17"}
4773a30a-91ee-4294-9c6e-a0468a013423	97373473-be11-45ee-99c2-9ce5a8823587	VND	SUCCESS	2025-12-02 16:42:47.251	2025-12-02 16:43:08.411	\N	\N	\N	1764693766302580	200000	109420232682-0938848615-CSHY10XCNK2zz 1764693766302580	SEPAY	t	200000	COMPLETED	{"qr_code": "00020101021238600010A000000727013000069704160116LOCCASS0003339510208QRIBFTTA530370454062000005802VN62320828CSHY10XCNK2 17646937663025806304D147", "checkout_url": "https://pay.payos.vn/web/30be887ded604522b87606a769e81cb2", "payment_link_id": "30be887ded604522b87606a769e81cb2"}	{"content": "109420232682-0938848615-CSHY10XCNK2 1764693766302580 GD 783108-120225 23:43:05", "sepay_id": 33628324, "bank_name": "ACB", "accumulated": 0, "description": "BankAPINotify 109420232682-0938848615-CSHY10XCNK2 1764693766302580 GD 783108-120225 23:43:05", "sub_account": null, "reference_code": "4128", "transaction_date": "2025-12-02 23:43:06"}
4fc1862e-6c9c-4727-a811-ffe9fa548878	225077b7-5714-4b71-8a01-235a85b7c7de	VND	SUCCESS	2025-12-10 07:28:05.313	2025-12-10 07:29:05.57	\N	\N	\N	1765351684732110	2000	CSEN359VKN0 1765351684732110	PAYOS	t	2000	COMPLETED	{"reference": "4174", "counter_account_name": null, "transaction_datetime": "2025-12-10T14:29:00.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": null, "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": ""}	\N
c9025bc0-0a90-4646-b817-e9926c16e4d0	19c454eb-fae4-4f75-8ef8-a824a9797779	VND	SUCCESS	2025-12-03 11:25:23.246	2025-12-03 11:29:05.141	\N	\N	\N	1764761122654414	2000	CSURDJVM9X0 1764761122654414	PAYOS	t	2000	COMPLETED	{"reference": "4130", "counter_account_name": "CONG TY CO PHAN ZION", "transaction_datetime": "2025-12-03T18:29:04.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": "212356786", "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": "TMCP Viet Nam Thinh Vuong"}	\N
aacd5c0c-7ec6-4a85-8277-aa3edb7d19bc	19c454eb-fae4-4f75-8ef8-a824a9797779	VND	SUCCESS	2025-12-03 11:29:06.043	2025-12-03 11:29:06.043	\N	\N	\N	\N	2000	CSURDJVM9X0 1764761122654414	SEPAY	t	2000	COMPLETED	\N	{"content": "ZP253370434996 251203002910845 CSURDJVM9X0 1764761122654414 GD 5337IBT1iWL2DHRV 031225-18:29:04", "sepayId": 33732573, "bankName": "ACB", "subAccount": null, "accumulated": 0, "description": "BankAPINotify ZP253370434996 251203002910845 CSURDJVM9X0 1764761122654414 GD 5337IBT1iWL2DHRV 031225-18:29:04", "referenceCode": "4130", "transactionDate": "2025-12-03 18:29:04"}
0d815d0c-07c6-4dc8-989b-4a1c8ad28e4f	3a4d44f4-3bf7-41d8-b4f7-5d9162cff157	VND	SUCCESS	2025-12-03 11:39:36.615	2025-12-03 11:42:14.834	\N	\N	\N	1764761976102683	3000	CSIO67EZD47 1764761976102683	SEPAY	t	3000	COMPLETED	{"reference": "4131", "counter_account_name": "CONG TY CO PHAN ZION", "transaction_datetime": "2025-12-03T11:42:11.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": "212356786", "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": "TMCP Viet Nam Thinh Vuong"}	{"content": "ZP253370448508 251203002966380 CSIO67EZD47 1764761976102683 GD 5337IBT1iWL2ITC9 031225-18:42:10", "sepay_id": 33734565, "bank_name": "ACB", "accumulated": 0, "description": "BankAPINotify ZP253370448508 251203002966380 CSIO67EZD47 1764761976102683 GD 5337IBT1iWL2ITC9 031225-18:42:10", "sub_account": null, "reference_code": "4131", "transaction_date": "2025-12-03 18:42:11"}
cf085fe4-8be8-4b3c-aa37-4db8b071babb	abb90d28-aa89-4425-b17c-b8609579a8e4	VND	SUCCESS	2025-12-03 12:01:19.48	2025-12-03 12:01:56.236	\N	\N	\N	1764763278844666	4000	CS2RPG7O6E9 1764763278844666	SEPAY	t	4000	COMPLETED	{"reference": "4132", "counter_account_name": "CONG TY CO PHAN ZION", "transaction_datetime": "2025-12-03T12:01:50.000Z", "virtual_account_name": "PHAN CANH BAO DUY", "counter_account_number": "212356786", "virtual_account_number": "LOCCASS000333951", "counter_account_bank_id": "", "counter_account_bank_name": "TMCP Viet Nam Thinh Vuong"}	{"content": "ZP253370461509 251203003033939 CS2RPG7O6E9 1764763278844666 GD 5337IBT1iWL25M5Z 031225-19:01:50", "sepay_id": 33737772, "bank_name": "ACB", "accumulated": 0, "description": "BankAPINotify ZP253370461509 251203003033939 CS2RPG7O6E9 1764763278844666 GD 5337IBT1iWL25M5Z 031225-19:01:50", "sub_account": null, "reference_code": "4132", "transaction_date": "2025-12-03 19:01:50"}
\.


--
-- TOC entry 4803 (class 0 OID 84100)
-- Dependencies: 240
-- Data for Name: planned_ingredients; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.planned_ingredients (id, campaign_phase_id, name, quantity, unit, created_at, updated_at) FROM stdin;
857ed670-88e1-440d-b225-4c23a25678f4	860f554b-fbab-4c42-b831-3a34584e084e	Tôm	60.00	kg	2025-12-07 02:08:09.62	2025-12-07 02:08:09.62
cac00ec6-e4cc-4ec4-8acd-57811f1352eb	860f554b-fbab-4c42-b831-3a34584e084e	Cua	40.00	kg	2025-12-07 02:08:09.62	2025-12-07 02:08:09.62
be3d7542-9e3a-4740-b8a3-15326da2515f	4119c551-0360-4e9b-a434-2c19c5cee97d	Tôm	60.60	kg	2025-12-08 07:50:53.728	2025-12-08 07:50:53.728
487fdc10-424e-4f84-be2e-a91477a675e3	4119c551-0360-4e9b-a434-2c19c5cee97d	Cua	40.46	kg	2025-12-08 07:50:53.728	2025-12-08 07:50:53.728
3a196f62-f4ab-4876-9e64-22e2cf7302f9	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	Cơm	20.00	Kg	2025-12-09 07:30:28.988	2025-12-09 07:30:28.988
a3efef34-70a3-4c82-b28c-d8ae4bcb3e55	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	Bò	10.00	Kg	2025-12-09 07:30:28.988	2025-12-09 07:30:28.988
a945bf96-1f7d-4c12-b277-43ffde0c9668	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	Sữa	100.00	Hộp	2025-12-09 07:30:28.988	2025-12-09 07:30:28.988
\.


--
-- TOC entry 4802 (class 0 OID 84091)
-- Dependencies: 239
-- Data for Name: planned_meals; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.planned_meals (id, campaign_phase_id, name, quantity, created_at, updated_at) FROM stdin;
1b729900-a788-4832-af74-d47ae3182c4b	860f554b-fbab-4c42-b831-3a34584e084e	Tôm hùm alaska	60	2025-12-07 02:08:09.453	2025-12-07 02:08:09.453
449ddb33-892f-4f59-8f7e-a3c21c9e6a25	860f554b-fbab-4c42-b831-3a34584e084e	Cua alaska	40	2025-12-07 02:08:09.453	2025-12-07 02:08:09.453
3bec23e0-4dfd-4e2c-85d3-c10ff6d4b2e3	860f554b-fbab-4c42-b831-3a34584e084e	Rượu vang	1	2025-12-07 02:08:09.453	2025-12-07 02:08:09.453
9dc5e32d-046f-45bb-b291-d6cfc26268fa	4119c551-0360-4e9b-a434-2c19c5cee97d	Tôm hùm alaska	60	2025-12-08 07:50:53.65	2025-12-08 07:50:53.65
c0da449d-b0ce-49f0-ad5d-8d7132c6a029	4119c551-0360-4e9b-a434-2c19c5cee97d	Cua alaska	40	2025-12-08 07:50:53.65	2025-12-08 07:50:53.65
81ef0049-cf0e-4d80-8a34-0238e7ef45dd	4119c551-0360-4e9b-a434-2c19c5cee97d	Rượu vang	1	2025-12-08 07:50:53.65	2025-12-08 07:50:53.65
0587710a-8628-40a1-8684-a46f4e391651	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	Cơm bò	100	2025-12-09 07:30:28.827	2025-12-09 07:30:28.827
490fca92-f9f5-4bfc-9c00-b4b3b70e343b	9565de73-dc0c-4fbd-a5ea-d8cbe459bd66	Sữa 	100	2025-12-09 07:30:28.827	2025-12-09 07:30:28.827
\.


--
-- TOC entry 4795 (class 0 OID 21799)
-- Dependencies: 228
-- Data for Name: post_comments; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.post_comments (id, post_id, user_id, content, parent_comment_id, comment_path, depth, created_at, updated_at, is_active) FROM stdin;
4ae12eec-c47b-4ecb-9582-9c27b6dc44ab	0cf0082d-185d-4050-9009-fd7485cbebb4	d96ae52c-1031-70ec-91a7-8a77026ec88c	Mong chờ quá đi!!	\N	\N	0	2025-12-02 16:45:10.444	2025-12-07 08:02:01.689	f
\.


--
-- TOC entry 4794 (class 0 OID 21791)
-- Dependencies: 227
-- Data for Name: post_likes; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.post_likes (id, post_id, user_id, created_at, updated_at) FROM stdin;
f89aa6a9-08a3-4f49-b3a1-dfae51014bf9	0cf0082d-185d-4050-9009-fd7485cbebb4	093ab54c-70f1-7008-1d8d-05adf6fc8748	2025-12-03 05:11:17.62	2025-12-03 05:11:17.62
5f1a5593-a156-40a8-938f-71a03a9d7e87	e80b2069-b97a-4d25-9a10-760e281980c5	093ab54c-70f1-7008-1d8d-05adf6fc8748	2025-12-03 05:12:40.896	2025-12-03 05:12:40.896
7581d04e-58ce-4f64-a1e5-36980045fb01	0cf0082d-185d-4050-9009-fd7485cbebb4	d96ae52c-1031-70ec-91a7-8a77026ec88c	2025-12-03 08:15:41.56	2025-12-03 08:15:41.56
f2aba44f-31b5-4761-8dcd-2dd112643320	e80b2069-b97a-4d25-9a10-760e281980c5	d96ae52c-1031-70ec-91a7-8a77026ec88c	2025-12-03 08:15:57.015	2025-12-03 08:15:57.015
cf1b7a68-aa87-4410-8810-3dcf26837814	0cf0082d-185d-4050-9009-fd7485cbebb4	19eaa51c-5061-7097-52d0-fa60f6db38e1	2025-12-07 03:45:00.19	2025-12-07 03:45:00.19
\.


--
-- TOC entry 4793 (class 0 OID 21780)
-- Dependencies: 226
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: doadmin
--

COPY public.posts (id, campaign_id, created_by, title, content, media, like_count, comment_count, is_active, created_at, updated_at) FROM stdin;
0cf0082d-185d-4050-9009-fd7485cbebb4	005725f5-42ed-4df5-8aef-7f22ca08a93c	d96ae52c-1031-70ec-91a7-8a77026ec88c	Video	<p class="tiptap-paragraph">Tụi trẻ </p>	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/posts/2025-12-02/e7c7c27d-temp-1764693589038-d96ae52c-1031-70ec-91a7-8a77026ec88c-1.mp4"]	3	0	t	2025-12-02 16:39:50.445	2025-12-07 08:02:01.689
e80b2069-b97a-4d25-9a10-760e281980c5	005725f5-42ed-4df5-8aef-7f22ca08a93c	d96ae52c-1031-70ec-91a7-8a77026ec88c	Hello	<p class="tiptap-paragraph">Sắp bắt đầu rồi mọi người ơi</p>	["https://foodfund.sgp1.cdn.digitaloceanspaces.com/posts/2025-12-02/65705037-temp-1764692530773-d96ae52c-1031-70ec-91a7-8a77026ec88c-1.jpeg"]	2	0	t	2025-12-02 16:22:13.038	2025-12-03 08:15:57.015
\.


--
-- TOC entry 4464 (class 2606 OID 21557)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4486 (class 2606 OID 21613)
-- Name: campaign_categories campaign_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaign_categories
    ADD CONSTRAINT campaign_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4533 (class 2606 OID 29639)
-- Name: campaign_phases campaign_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaign_phases
    ADD CONSTRAINT campaign_phases_pkey PRIMARY KEY (id);


--
-- TOC entry 4582 (class 2606 OID 75298)
-- Name: campaign_reassignments campaign_reassignments_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaign_reassignments
    ADD CONSTRAINT campaign_reassignments_pkey PRIMARY KEY (id);


--
-- TOC entry 4472 (class 2606 OID 21583)
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- TOC entry 4483 (class 2606 OID 21593)
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- TOC entry 4543 (class 2606 OID 61671)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id, created_at);


--
-- TOC entry 4548 (class 2606 OID 61683)
-- Name: notifications_2025_11 notifications_2025_11_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications_2025_11
    ADD CONSTRAINT notifications_2025_11_pkey PRIMARY KEY (id, created_at);


--
-- TOC entry 4558 (class 2606 OID 61697)
-- Name: notifications_2025_12 notifications_2025_12_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications_2025_12
    ADD CONSTRAINT notifications_2025_12_pkey PRIMARY KEY (id, created_at);


--
-- TOC entry 4568 (class 2606 OID 61711)
-- Name: notifications_2026_01 notifications_2026_01_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.notifications_2026_01
    ADD CONSTRAINT notifications_2026_01_pkey PRIMARY KEY (id, created_at);


--
-- TOC entry 4585 (class 2606 OID 80558)
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4493 (class 2606 OID 28598)
-- Name: payment_transactions payment_transactions_order_code_key; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_code_key UNIQUE (order_code);


--
-- TOC entry 4496 (class 2606 OID 21779)
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4593 (class 2606 OID 84108)
-- Name: planned_ingredients planned_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.planned_ingredients
    ADD CONSTRAINT planned_ingredients_pkey PRIMARY KEY (id);


--
-- TOC entry 4589 (class 2606 OID 84099)
-- Name: planned_meals planned_meals_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_pkey PRIMARY KEY (id);


--
-- TOC entry 4521 (class 2606 OID 21807)
-- Name: post_comments post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);


--
-- TOC entry 4510 (class 2606 OID 21798)
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);


--
-- TOC entry 4507 (class 2606 OID 21790)
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- TOC entry 4484 (class 1259 OID 21614)
-- Name: campaign_categories_is_active_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_categories_is_active_idx ON public.campaign_categories USING btree (is_active);


--
-- TOC entry 4487 (class 1259 OID 21615)
-- Name: campaign_categories_title_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_categories_title_idx ON public.campaign_categories USING btree (title);


--
-- TOC entry 4526 (class 1259 OID 29640)
-- Name: campaign_phases_campaign_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_campaign_id_idx ON public.campaign_phases USING btree (campaign_id);


--
-- TOC entry 4527 (class 1259 OID 90000)
-- Name: campaign_phases_campaign_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_campaign_id_status_idx ON public.campaign_phases USING btree (campaign_id, status);


--
-- TOC entry 4528 (class 1259 OID 29645)
-- Name: campaign_phases_cooking_date_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_cooking_date_idx ON public.campaign_phases USING btree (cooking_date);


--
-- TOC entry 4529 (class 1259 OID 29642)
-- Name: campaign_phases_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_created_at_idx ON public.campaign_phases USING btree (created_at);


--
-- TOC entry 4530 (class 1259 OID 29646)
-- Name: campaign_phases_delivery_date_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_delivery_date_idx ON public.campaign_phases USING btree (delivery_date);


--
-- TOC entry 4531 (class 1259 OID 29644)
-- Name: campaign_phases_ingredient_purchase_date_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_ingredient_purchase_date_idx ON public.campaign_phases USING btree (ingredient_purchase_date);


--
-- TOC entry 4534 (class 1259 OID 89999)
-- Name: campaign_phases_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_phases_status_idx ON public.campaign_phases USING btree (status);


--
-- TOC entry 4575 (class 1259 OID 75299)
-- Name: campaign_reassignments_campaign_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_reassignments_campaign_id_idx ON public.campaign_reassignments USING btree (campaign_id);


--
-- TOC entry 4576 (class 1259 OID 75305)
-- Name: campaign_reassignments_campaign_id_organization_id_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX campaign_reassignments_campaign_id_organization_id_key ON public.campaign_reassignments USING btree (campaign_id, organization_id);


--
-- TOC entry 4577 (class 1259 OID 75304)
-- Name: campaign_reassignments_campaign_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_reassignments_campaign_id_status_idx ON public.campaign_reassignments USING btree (campaign_id, status);


--
-- TOC entry 4578 (class 1259 OID 75302)
-- Name: campaign_reassignments_expires_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_reassignments_expires_at_idx ON public.campaign_reassignments USING btree (expires_at);


--
-- TOC entry 4579 (class 1259 OID 75300)
-- Name: campaign_reassignments_organization_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_reassignments_organization_id_idx ON public.campaign_reassignments USING btree (organization_id);


--
-- TOC entry 4580 (class 1259 OID 75303)
-- Name: campaign_reassignments_organization_id_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_reassignments_organization_id_status_idx ON public.campaign_reassignments USING btree (organization_id, status);


--
-- TOC entry 4583 (class 1259 OID 75301)
-- Name: campaign_reassignments_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaign_reassignments_status_idx ON public.campaign_reassignments USING btree (status);


--
-- TOC entry 4465 (class 1259 OID 21616)
-- Name: campaigns_category_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_category_id_idx ON public.campaigns USING btree (category_id);


--
-- TOC entry 4466 (class 1259 OID 29647)
-- Name: campaigns_changed_status_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_changed_status_at_idx ON public.campaigns USING btree (changed_status_at);


--
-- TOC entry 4467 (class 1259 OID 21601)
-- Name: campaigns_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_created_at_idx ON public.campaigns USING btree (created_at);


--
-- TOC entry 4468 (class 1259 OID 21600)
-- Name: campaigns_created_by_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_created_by_idx ON public.campaigns USING btree (created_by);


--
-- TOC entry 4469 (class 1259 OID 47246)
-- Name: campaigns_donation_count_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_donation_count_idx ON public.campaigns USING btree (donation_count);


--
-- TOC entry 4470 (class 1259 OID 21831)
-- Name: campaigns_fundraising_start_date_fundraising_end_date_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_fundraising_start_date_fundraising_end_date_idx ON public.campaigns USING btree (fundraising_start_date, fundraising_end_date);


--
-- TOC entry 4473 (class 1259 OID 78468)
-- Name: campaigns_slug_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_slug_idx ON public.campaigns USING btree (slug);


--
-- TOC entry 4474 (class 1259 OID 78467)
-- Name: campaigns_slug_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX campaigns_slug_key ON public.campaigns USING btree (slug);


--
-- TOC entry 4475 (class 1259 OID 29648)
-- Name: campaigns_status_changed_status_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_status_changed_status_at_idx ON public.campaigns USING btree (status, changed_status_at);


--
-- TOC entry 4476 (class 1259 OID 29612)
-- Name: campaigns_status_fundraising_end_date_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_status_fundraising_end_date_idx ON public.campaigns USING btree (status, fundraising_end_date);


--
-- TOC entry 4477 (class 1259 OID 29611)
-- Name: campaigns_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX campaigns_status_idx ON public.campaigns USING btree (status);


--
-- TOC entry 4478 (class 1259 OID 21834)
-- Name: donations_campaign_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX donations_campaign_id_created_at_idx ON public.donations USING btree (campaign_id, created_at);


--
-- TOC entry 4479 (class 1259 OID 21603)
-- Name: donations_campaign_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX donations_campaign_id_idx ON public.donations USING btree (campaign_id);


--
-- TOC entry 4480 (class 1259 OID 21833)
-- Name: donations_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX donations_created_at_idx ON public.donations USING btree (created_at);


--
-- TOC entry 4481 (class 1259 OID 21604)
-- Name: donations_donor_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX donations_donor_id_idx ON public.donations USING btree (donor_id);


--
-- TOC entry 4535 (class 1259 OID 71397)
-- Name: idx_entity_lookup; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_entity_lookup ON ONLY public.notifications USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4536 (class 1259 OID 71409)
-- Name: idx_notifications_cursor; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_notifications_cursor ON ONLY public.notifications USING btree (user_id, created_at DESC, id DESC);


--
-- TOC entry 4537 (class 1259 OID 71413)
-- Name: idx_notifications_entity; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_notifications_entity ON ONLY public.notifications USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4538 (class 1259 OID 61673)
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_notifications_unread ON ONLY public.notifications USING btree (user_id, created_at) WHERE (is_read = false);


--
-- TOC entry 4539 (class 1259 OID 71405)
-- Name: idx_type_recent; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_type_recent ON ONLY public.notifications USING btree (type, created_at);


--
-- TOC entry 4540 (class 1259 OID 71393)
-- Name: idx_user_timeline; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_user_timeline ON ONLY public.notifications USING btree (user_id, created_at, id);


--
-- TOC entry 4541 (class 1259 OID 71401)
-- Name: idx_user_unread_recent; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX idx_user_unread_recent ON ONLY public.notifications USING btree (user_id, is_read, created_at);


--
-- TOC entry 4545 (class 1259 OID 71398)
-- Name: notifications_2025_11_entity_type_entity_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_entity_type_entity_id_created_at_idx ON public.notifications_2025_11 USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4546 (class 1259 OID 71414)
-- Name: notifications_2025_11_entity_type_entity_id_created_at_idx1; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_entity_type_entity_id_created_at_idx1 ON public.notifications_2025_11 USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4549 (class 1259 OID 71406)
-- Name: notifications_2025_11_type_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_type_created_at_idx ON public.notifications_2025_11 USING btree (type, created_at);


--
-- TOC entry 4550 (class 1259 OID 71394)
-- Name: notifications_2025_11_user_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_user_id_created_at_id_idx ON public.notifications_2025_11 USING btree (user_id, created_at, id);


--
-- TOC entry 4551 (class 1259 OID 71410)
-- Name: notifications_2025_11_user_id_created_at_id_idx1; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_user_id_created_at_id_idx1 ON public.notifications_2025_11 USING btree (user_id, created_at DESC, id DESC);


--
-- TOC entry 4552 (class 1259 OID 61685)
-- Name: notifications_2025_11_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_user_id_created_at_idx ON public.notifications_2025_11 USING btree (user_id, created_at) WHERE (is_read = false);


--
-- TOC entry 4544 (class 1259 OID 66681)
-- Name: unique_notification_event; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX unique_notification_event ON ONLY public.notifications USING btree (user_id, entity_type, entity_id, type, created_at);


--
-- TOC entry 4553 (class 1259 OID 66682)
-- Name: notifications_2025_11_user_id_entity_type_entity_id_type_cr_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX notifications_2025_11_user_id_entity_type_entity_id_type_cr_idx ON public.notifications_2025_11 USING btree (user_id, entity_type, entity_id, type, created_at);


--
-- TOC entry 4554 (class 1259 OID 71402)
-- Name: notifications_2025_11_user_id_is_read_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_11_user_id_is_read_created_at_idx ON public.notifications_2025_11 USING btree (user_id, is_read, created_at);


--
-- TOC entry 4555 (class 1259 OID 71399)
-- Name: notifications_2025_12_entity_type_entity_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_entity_type_entity_id_created_at_idx ON public.notifications_2025_12 USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4556 (class 1259 OID 71415)
-- Name: notifications_2025_12_entity_type_entity_id_created_at_idx1; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_entity_type_entity_id_created_at_idx1 ON public.notifications_2025_12 USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4559 (class 1259 OID 71407)
-- Name: notifications_2025_12_type_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_type_created_at_idx ON public.notifications_2025_12 USING btree (type, created_at);


--
-- TOC entry 4560 (class 1259 OID 71395)
-- Name: notifications_2025_12_user_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_user_id_created_at_id_idx ON public.notifications_2025_12 USING btree (user_id, created_at, id);


--
-- TOC entry 4561 (class 1259 OID 71411)
-- Name: notifications_2025_12_user_id_created_at_id_idx1; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_user_id_created_at_id_idx1 ON public.notifications_2025_12 USING btree (user_id, created_at DESC, id DESC);


--
-- TOC entry 4562 (class 1259 OID 61699)
-- Name: notifications_2025_12_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_user_id_created_at_idx ON public.notifications_2025_12 USING btree (user_id, created_at) WHERE (is_read = false);


--
-- TOC entry 4563 (class 1259 OID 66683)
-- Name: notifications_2025_12_user_id_entity_type_entity_id_type_cr_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX notifications_2025_12_user_id_entity_type_entity_id_type_cr_idx ON public.notifications_2025_12 USING btree (user_id, entity_type, entity_id, type, created_at);


--
-- TOC entry 4564 (class 1259 OID 71403)
-- Name: notifications_2025_12_user_id_is_read_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2025_12_user_id_is_read_created_at_idx ON public.notifications_2025_12 USING btree (user_id, is_read, created_at);


--
-- TOC entry 4565 (class 1259 OID 71400)
-- Name: notifications_2026_01_entity_type_entity_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_entity_type_entity_id_created_at_idx ON public.notifications_2026_01 USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4566 (class 1259 OID 71416)
-- Name: notifications_2026_01_entity_type_entity_id_created_at_idx1; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_entity_type_entity_id_created_at_idx1 ON public.notifications_2026_01 USING btree (entity_type, entity_id, created_at);


--
-- TOC entry 4569 (class 1259 OID 71408)
-- Name: notifications_2026_01_type_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_type_created_at_idx ON public.notifications_2026_01 USING btree (type, created_at);


--
-- TOC entry 4570 (class 1259 OID 71396)
-- Name: notifications_2026_01_user_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_user_id_created_at_id_idx ON public.notifications_2026_01 USING btree (user_id, created_at, id);


--
-- TOC entry 4571 (class 1259 OID 71412)
-- Name: notifications_2026_01_user_id_created_at_id_idx1; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_user_id_created_at_id_idx1 ON public.notifications_2026_01 USING btree (user_id, created_at DESC, id DESC);


--
-- TOC entry 4572 (class 1259 OID 61713)
-- Name: notifications_2026_01_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_user_id_created_at_idx ON public.notifications_2026_01 USING btree (user_id, created_at) WHERE (is_read = false);


--
-- TOC entry 4573 (class 1259 OID 66684)
-- Name: notifications_2026_01_user_id_entity_type_entity_id_type_cr_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX notifications_2026_01_user_id_entity_type_entity_id_type_cr_idx ON public.notifications_2026_01 USING btree (user_id, entity_type, entity_id, type, created_at);


--
-- TOC entry 4574 (class 1259 OID 71404)
-- Name: notifications_2026_01_user_id_is_read_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX notifications_2026_01_user_id_is_read_created_at_idx ON public.notifications_2026_01 USING btree (user_id, is_read, created_at);


--
-- TOC entry 4586 (class 1259 OID 80559)
-- Name: outbox_events_status_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX outbox_events_status_created_at_idx ON public.outbox_events USING btree (status, created_at);


--
-- TOC entry 4488 (class 1259 OID 21810)
-- Name: payment_transactions_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_created_at_idx ON public.payment_transactions USING btree (created_at);


--
-- TOC entry 4489 (class 1259 OID 21808)
-- Name: payment_transactions_donation_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_donation_id_idx ON public.payment_transactions USING btree (donation_id);


--
-- TOC entry 4490 (class 1259 OID 35260)
-- Name: payment_transactions_gateway_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_gateway_idx ON public.payment_transactions USING btree (gateway);


--
-- TOC entry 4491 (class 1259 OID 28594)
-- Name: payment_transactions_order_code_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_order_code_idx ON public.payment_transactions USING btree (order_code);


--
-- TOC entry 4494 (class 1259 OID 38016)
-- Name: payment_transactions_payment_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_payment_status_idx ON public.payment_transactions USING btree (payment_status);


--
-- TOC entry 4497 (class 1259 OID 35261)
-- Name: payment_transactions_processed_by_webhook_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_processed_by_webhook_idx ON public.payment_transactions USING btree (processed_by_webhook);


--
-- TOC entry 4498 (class 1259 OID 35264)
-- Name: payment_transactions_status_gateway_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_status_gateway_idx ON public.payment_transactions USING btree (status, gateway);


--
-- TOC entry 4499 (class 1259 OID 21809)
-- Name: payment_transactions_status_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX payment_transactions_status_idx ON public.payment_transactions USING btree (status);


--
-- TOC entry 4590 (class 1259 OID 84110)
-- Name: planned_ingredients_campaign_phase_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX planned_ingredients_campaign_phase_id_idx ON public.planned_ingredients USING btree (campaign_phase_id);


--
-- TOC entry 4591 (class 1259 OID 84111)
-- Name: planned_ingredients_name_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX planned_ingredients_name_idx ON public.planned_ingredients USING btree (name);


--
-- TOC entry 4587 (class 1259 OID 84109)
-- Name: planned_meals_campaign_phase_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX planned_meals_campaign_phase_id_idx ON public.planned_meals USING btree (campaign_phase_id);


--
-- TOC entry 4515 (class 1259 OID 21829)
-- Name: post_comments_comment_path_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_comment_path_idx ON public.post_comments USING btree (comment_path);


--
-- TOC entry 4516 (class 1259 OID 21827)
-- Name: post_comments_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_created_at_idx ON public.post_comments USING btree (created_at);


--
-- TOC entry 4517 (class 1259 OID 21830)
-- Name: post_comments_depth_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_depth_idx ON public.post_comments USING btree (depth);


--
-- TOC entry 4518 (class 1259 OID 22917)
-- Name: post_comments_is_active_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_is_active_idx ON public.post_comments USING btree (is_active);


--
-- TOC entry 4519 (class 1259 OID 21826)
-- Name: post_comments_parent_comment_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_parent_comment_id_idx ON public.post_comments USING btree (parent_comment_id);


--
-- TOC entry 4522 (class 1259 OID 21824)
-- Name: post_comments_post_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_post_id_idx ON public.post_comments USING btree (post_id);


--
-- TOC entry 4523 (class 1259 OID 22918)
-- Name: post_comments_post_id_is_active_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_post_id_is_active_created_at_idx ON public.post_comments USING btree (post_id, is_active, created_at);


--
-- TOC entry 4524 (class 1259 OID 21828)
-- Name: post_comments_post_id_parent_comment_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_post_id_parent_comment_id_created_at_idx ON public.post_comments USING btree (post_id, parent_comment_id, created_at);


--
-- TOC entry 4525 (class 1259 OID 21825)
-- Name: post_comments_user_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_comments_user_id_idx ON public.post_comments USING btree (user_id);


--
-- TOC entry 4508 (class 1259 OID 21821)
-- Name: post_likes_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_likes_created_at_idx ON public.post_likes USING btree (created_at);


--
-- TOC entry 4511 (class 1259 OID 21822)
-- Name: post_likes_post_id_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_likes_post_id_created_at_idx ON public.post_likes USING btree (post_id, created_at);


--
-- TOC entry 4512 (class 1259 OID 21819)
-- Name: post_likes_post_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_likes_post_id_idx ON public.post_likes USING btree (post_id);


--
-- TOC entry 4513 (class 1259 OID 21823)
-- Name: post_likes_post_id_user_id_key; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE UNIQUE INDEX post_likes_post_id_user_id_key ON public.post_likes USING btree (post_id, user_id);


--
-- TOC entry 4514 (class 1259 OID 21820)
-- Name: post_likes_user_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX post_likes_user_id_idx ON public.post_likes USING btree (user_id);


--
-- TOC entry 4500 (class 1259 OID 21813)
-- Name: posts_campaign_id_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX posts_campaign_id_idx ON public.posts USING btree (campaign_id);


--
-- TOC entry 4501 (class 1259 OID 21817)
-- Name: posts_campaign_id_is_active_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX posts_campaign_id_is_active_created_at_idx ON public.posts USING btree (campaign_id, is_active, created_at);


--
-- TOC entry 4502 (class 1259 OID 21816)
-- Name: posts_created_at_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at);


--
-- TOC entry 4503 (class 1259 OID 21814)
-- Name: posts_created_by_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX posts_created_by_idx ON public.posts USING btree (created_by);


--
-- TOC entry 4504 (class 1259 OID 21815)
-- Name: posts_is_active_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX posts_is_active_idx ON public.posts USING btree (is_active);


--
-- TOC entry 4505 (class 1259 OID 21818)
-- Name: posts_like_count_idx; Type: INDEX; Schema: public; Owner: doadmin
--

CREATE INDEX posts_like_count_idx ON public.posts USING btree (like_count);


--
-- TOC entry 4594 (class 0 OID 0)
-- Name: notifications_2025_11_entity_type_entity_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_entity_lookup ATTACH PARTITION public.notifications_2025_11_entity_type_entity_id_created_at_idx;


--
-- TOC entry 4595 (class 0 OID 0)
-- Name: notifications_2025_11_entity_type_entity_id_created_at_idx1; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_entity ATTACH PARTITION public.notifications_2025_11_entity_type_entity_id_created_at_idx1;


--
-- TOC entry 4596 (class 0 OID 0)
-- Name: notifications_2025_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.notifications_pkey ATTACH PARTITION public.notifications_2025_11_pkey;


--
-- TOC entry 4597 (class 0 OID 0)
-- Name: notifications_2025_11_type_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_type_recent ATTACH PARTITION public.notifications_2025_11_type_created_at_idx;


--
-- TOC entry 4598 (class 0 OID 0)
-- Name: notifications_2025_11_user_id_created_at_id_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_user_timeline ATTACH PARTITION public.notifications_2025_11_user_id_created_at_id_idx;


--
-- TOC entry 4599 (class 0 OID 0)
-- Name: notifications_2025_11_user_id_created_at_id_idx1; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_cursor ATTACH PARTITION public.notifications_2025_11_user_id_created_at_id_idx1;


--
-- TOC entry 4600 (class 0 OID 0)
-- Name: notifications_2025_11_user_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_unread ATTACH PARTITION public.notifications_2025_11_user_id_created_at_idx;


--
-- TOC entry 4601 (class 0 OID 0)
-- Name: notifications_2025_11_user_id_entity_type_entity_id_type_cr_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.unique_notification_event ATTACH PARTITION public.notifications_2025_11_user_id_entity_type_entity_id_type_cr_idx;


--
-- TOC entry 4602 (class 0 OID 0)
-- Name: notifications_2025_11_user_id_is_read_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_user_unread_recent ATTACH PARTITION public.notifications_2025_11_user_id_is_read_created_at_idx;


--
-- TOC entry 4603 (class 0 OID 0)
-- Name: notifications_2025_12_entity_type_entity_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_entity_lookup ATTACH PARTITION public.notifications_2025_12_entity_type_entity_id_created_at_idx;


--
-- TOC entry 4604 (class 0 OID 0)
-- Name: notifications_2025_12_entity_type_entity_id_created_at_idx1; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_entity ATTACH PARTITION public.notifications_2025_12_entity_type_entity_id_created_at_idx1;


--
-- TOC entry 4605 (class 0 OID 0)
-- Name: notifications_2025_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.notifications_pkey ATTACH PARTITION public.notifications_2025_12_pkey;


--
-- TOC entry 4606 (class 0 OID 0)
-- Name: notifications_2025_12_type_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_type_recent ATTACH PARTITION public.notifications_2025_12_type_created_at_idx;


--
-- TOC entry 4607 (class 0 OID 0)
-- Name: notifications_2025_12_user_id_created_at_id_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_user_timeline ATTACH PARTITION public.notifications_2025_12_user_id_created_at_id_idx;


--
-- TOC entry 4608 (class 0 OID 0)
-- Name: notifications_2025_12_user_id_created_at_id_idx1; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_cursor ATTACH PARTITION public.notifications_2025_12_user_id_created_at_id_idx1;


--
-- TOC entry 4609 (class 0 OID 0)
-- Name: notifications_2025_12_user_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_unread ATTACH PARTITION public.notifications_2025_12_user_id_created_at_idx;


--
-- TOC entry 4610 (class 0 OID 0)
-- Name: notifications_2025_12_user_id_entity_type_entity_id_type_cr_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.unique_notification_event ATTACH PARTITION public.notifications_2025_12_user_id_entity_type_entity_id_type_cr_idx;


--
-- TOC entry 4611 (class 0 OID 0)
-- Name: notifications_2025_12_user_id_is_read_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_user_unread_recent ATTACH PARTITION public.notifications_2025_12_user_id_is_read_created_at_idx;


--
-- TOC entry 4612 (class 0 OID 0)
-- Name: notifications_2026_01_entity_type_entity_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_entity_lookup ATTACH PARTITION public.notifications_2026_01_entity_type_entity_id_created_at_idx;


--
-- TOC entry 4613 (class 0 OID 0)
-- Name: notifications_2026_01_entity_type_entity_id_created_at_idx1; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_entity ATTACH PARTITION public.notifications_2026_01_entity_type_entity_id_created_at_idx1;


--
-- TOC entry 4614 (class 0 OID 0)
-- Name: notifications_2026_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.notifications_pkey ATTACH PARTITION public.notifications_2026_01_pkey;


--
-- TOC entry 4615 (class 0 OID 0)
-- Name: notifications_2026_01_type_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_type_recent ATTACH PARTITION public.notifications_2026_01_type_created_at_idx;


--
-- TOC entry 4616 (class 0 OID 0)
-- Name: notifications_2026_01_user_id_created_at_id_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_user_timeline ATTACH PARTITION public.notifications_2026_01_user_id_created_at_id_idx;


--
-- TOC entry 4617 (class 0 OID 0)
-- Name: notifications_2026_01_user_id_created_at_id_idx1; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_cursor ATTACH PARTITION public.notifications_2026_01_user_id_created_at_id_idx1;


--
-- TOC entry 4618 (class 0 OID 0)
-- Name: notifications_2026_01_user_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_notifications_unread ATTACH PARTITION public.notifications_2026_01_user_id_created_at_idx;


--
-- TOC entry 4619 (class 0 OID 0)
-- Name: notifications_2026_01_user_id_entity_type_entity_id_type_cr_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.unique_notification_event ATTACH PARTITION public.notifications_2026_01_user_id_entity_type_entity_id_type_cr_idx;


--
-- TOC entry 4620 (class 0 OID 0)
-- Name: notifications_2026_01_user_id_is_read_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: doadmin
--

ALTER INDEX public.idx_user_unread_recent ATTACH PARTITION public.notifications_2026_01_user_id_is_read_created_at_idx;


--
-- TOC entry 4628 (class 2606 OID 29649)
-- Name: campaign_phases campaign_phases_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaign_phases
    ADD CONSTRAINT campaign_phases_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4629 (class 2606 OID 75306)
-- Name: campaign_reassignments campaign_reassignments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaign_reassignments
    ADD CONSTRAINT campaign_reassignments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4621 (class 2606 OID 21617)
-- Name: campaigns campaigns_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.campaign_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4622 (class 2606 OID 21594)
-- Name: donations donations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4623 (class 2606 OID 21835)
-- Name: payment_transactions payment_transactions_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4631 (class 2606 OID 84117)
-- Name: planned_ingredients planned_ingredients_campaign_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.planned_ingredients
    ADD CONSTRAINT planned_ingredients_campaign_phase_id_fkey FOREIGN KEY (campaign_phase_id) REFERENCES public.campaign_phases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4630 (class 2606 OID 84112)
-- Name: planned_meals planned_meals_campaign_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_campaign_phase_id_fkey FOREIGN KEY (campaign_phase_id) REFERENCES public.campaign_phases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4626 (class 2606 OID 21855)
-- Name: post_comments post_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.post_comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4627 (class 2606 OID 21850)
-- Name: post_comments post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4625 (class 2606 OID 21845)
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4624 (class 2606 OID 21840)
-- Name: posts posts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doadmin
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4809 (class 0 OID 0)
-- Dependencies: 7
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: doadmin
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO cdc_user;


--
-- TOC entry 4810 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE _prisma_migrations; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public._prisma_migrations TO cdc_user;


--
-- TOC entry 4811 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE campaign_categories; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.campaign_categories TO cdc_user;


--
-- TOC entry 4812 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE campaign_phases; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.campaign_phases TO cdc_user;


--
-- TOC entry 4813 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE campaign_reassignments; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.campaign_reassignments TO cdc_user;


--
-- TOC entry 4814 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE campaigns; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.campaigns TO cdc_user;


--
-- TOC entry 4815 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE donations; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.donations TO cdc_user;


--
-- TOC entry 4816 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.notifications TO cdc_user;


--
-- TOC entry 4817 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE notifications_2025_11; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.notifications_2025_11 TO cdc_user;


--
-- TOC entry 4818 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE notifications_2025_12; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.notifications_2025_12 TO cdc_user;


--
-- TOC entry 4819 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE notifications_2026_01; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.notifications_2026_01 TO cdc_user;


--
-- TOC entry 4820 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE outbox_events; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.outbox_events TO cdc_user;


--
-- TOC entry 4821 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE payment_transactions; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.payment_transactions TO cdc_user;


--
-- TOC entry 4822 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE post_comments; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.post_comments TO cdc_user;


--
-- TOC entry 4823 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE post_likes; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.post_likes TO cdc_user;


--
-- TOC entry 4824 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: doadmin
--

GRANT ALL ON TABLE public.posts TO cdc_user;


-- Completed on 2025-12-11 10:15:02

--
-- PostgreSQL database dump complete
--

