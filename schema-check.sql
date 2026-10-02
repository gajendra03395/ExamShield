--
-- PostgreSQL database dump
--

\restrict tGku7UFfH0vE1rdB91aPSw07B06TyOSG7BujHLrevEFg1YcOJ26MSF9jlxNQjVG

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

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
-- Name: DifficultyLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DifficultyLevel" AS ENUM (
    'EASY',
    'MEDIUM',
    'HARD'
);


--
-- Name: EvaluationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EvaluationStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
);


--
-- Name: ProgrammingLanguage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProgrammingLanguage" AS ENUM (
    'JAVA',
    'CPP',
    'PYTHON',
    'C',
    'NONE'
);


--
-- Name: QuestionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuestionType" AS ENUM (
    'MCQ',
    'MULTI_SELECT',
    'TRUE_FALSE',
    'CODE_WRITING',
    'CODE_COMPLETION',
    'ERROR_FINDING',
    'PROBLEM_IDENTIFICATION',
    'SHORT_ANSWER'
);


--
-- Name: TestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TestStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'LIVE',
    'COMPLETED',
    'RESULTS_PUBLISHED'
);


--
-- Name: ViolationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ViolationType" AS ENUM (
    'WINDOW_SWITCH',
    'ALT_TAB',
    'TASK_MANAGER',
    'PRINT_SCREEN',
    'SCREEN_MINIMIZE',
    'USB_DEVICE',
    'PROCESS_LAUNCH',
    'NETWORK_DISCONNECT',
    'VM_DETECTED',
    'CLIPBOARD_ACCESS',
    'RIGHT_CLICK',
    'KEYBOARD_SHORTCUT',
    'MULTI_MONITOR',
    'SCREEN_SHARE',
    'UNKNOWN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    user_type text NOT NULL,
    user_id text NOT NULL,
    action text NOT NULL,
    details jsonb,
    ip_address text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batches (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.divisions (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: faculties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculties (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    department text,
    subject text,
    is_active boolean DEFAULT true NOT NULL,
    approved_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: question_bank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_bank (
    id text NOT NULL,
    faculty_id text NOT NULL,
    question_type public."QuestionType" NOT NULL,
    difficulty public."DifficultyLevel" DEFAULT 'MEDIUM'::public."DifficultyLevel" NOT NULL,
    language public."ProgrammingLanguage" DEFAULT 'NONE'::public."ProgrammingLanguage" NOT NULL,
    subject text NOT NULL,
    topic text,
    question_text text NOT NULL,
    question_image_url text,
    code_snippet text,
    code_language text,
    options jsonb,
    expected_output text,
    test_cases jsonb,
    solution_code text,
    marks double precision DEFAULT 1 NOT NULL,
    explanation text,
    tags text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: section_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_questions (
    id text NOT NULL,
    section_id text NOT NULL,
    question_id text NOT NULL,
    question_order integer,
    marks_override double precision,
    is_pool boolean DEFAULT false NOT NULL
);


--
-- Name: student_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_answers (
    id text NOT NULL,
    student_test_id text NOT NULL,
    question_id text NOT NULL,
    section_id text,
    selected_options jsonb,
    code_answer text,
    text_answer text,
    is_correct boolean,
    marks_awarded double precision,
    faculty_comment text,
    time_spent_seconds integer,
    is_flagged boolean DEFAULT false NOT NULL,
    answered_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    evaluator_feedback text,
    is_evaluated boolean DEFAULT false NOT NULL,
    marks_obtained double precision DEFAULT 0 NOT NULL
);


--
-- Name: student_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_tests (
    id text NOT NULL,
    test_id text NOT NULL,
    student_id text NOT NULL,
    assigned_questions jsonb NOT NULL,
    status text DEFAULT 'NOT_STARTED'::text NOT NULL,
    started_at timestamp(3) without time zone,
    submitted_at timestamp(3) without time zone,
    time_remaining_sec integer,
    total_score double precision DEFAULT 0 NOT NULL,
    auto_graded_score double precision,
    manual_graded_score double precision,
    is_graded boolean DEFAULT false NOT NULL,
    graded_by text,
    graded_at timestamp(3) without time zone,
    violation_count integer DEFAULT 0 NOT NULL,
    submission_reason text,
    machine_id text,
    ip_address text,
    os_version text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    code_score double precision DEFAULT 0 NOT NULL,
    evaluated_at timestamp(3) without time zone,
    evaluation_status public."EvaluationStatus" DEFAULT 'PENDING'::public."EvaluationStatus" NOT NULL,
    faculty_remarks text,
    mcq_score double precision DEFAULT 0 NOT NULL,
    percentage double precision DEFAULT 0 NOT NULL
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id text NOT NULL,
    name text NOT NULL,
    enrollment_no text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    batch text NOT NULL,
    division text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: test_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_sections (
    id text NOT NULL,
    test_id text NOT NULL,
    title text NOT NULL,
    description text,
    section_order integer NOT NULL,
    marks_per_question double precision,
    total_marks double precision NOT NULL,
    pick_random boolean DEFAULT false NOT NULL,
    random_count integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id text NOT NULL,
    faculty_id text NOT NULL,
    title text NOT NULL,
    description text,
    subject text NOT NULL,
    start_time timestamp(3) without time zone NOT NULL,
    end_time timestamp(3) without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    total_marks double precision NOT NULL,
    passing_marks double precision,
    shuffle_questions boolean DEFAULT true NOT NULL,
    shuffle_options boolean DEFAULT true NOT NULL,
    show_marks_per_question boolean DEFAULT true NOT NULL,
    allow_review boolean DEFAULT true NOT NULL,
    auto_submit_on_time boolean DEFAULT true NOT NULL,
    enable_lockdown boolean DEFAULT true NOT NULL,
    max_violations integer DEFAULT 3 NOT NULL,
    detect_vm boolean DEFAULT true NOT NULL,
    detect_usb boolean DEFAULT true NOT NULL,
    block_processes boolean DEFAULT true NOT NULL,
    target_batches text[],
    target_divisions text[],
    status public."TestStatus" DEFAULT 'DRAFT'::public."TestStatus" NOT NULL,
    results_published_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    published_by text,
    results_published boolean DEFAULT false NOT NULL
);


--
-- Name: violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.violations (
    id text NOT NULL,
    student_test_id text NOT NULL,
    student_id text NOT NULL,
    test_id text NOT NULL,
    violation_type public."ViolationType" NOT NULL,
    description text,
    key_combination text,
    process_name text,
    screenshot_url text,
    violation_number integer NOT NULL,
    action_taken text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    client_event_id text
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: divisions divisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT divisions_pkey PRIMARY KEY (id);


--
-- Name: faculties faculties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties
    ADD CONSTRAINT faculties_pkey PRIMARY KEY (id);


--
-- Name: question_bank question_bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);


--
-- Name: section_questions section_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_questions
    ADD CONSTRAINT section_questions_pkey PRIMARY KEY (id);


--
-- Name: student_answers student_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_answers
    ADD CONSTRAINT student_answers_pkey PRIMARY KEY (id);


--
-- Name: student_tests student_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tests
    ADD CONSTRAINT student_tests_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: test_sections test_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_sections
    ADD CONSTRAINT test_sections_pkey PRIMARY KEY (id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: violations violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_pkey PRIMARY KEY (id);


--
-- Name: admins_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admins_email_key ON public.admins USING btree (email);


--
-- Name: batches_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX batches_name_key ON public.batches USING btree (name);


--
-- Name: divisions_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX divisions_name_key ON public.divisions USING btree (name);


--
-- Name: faculties_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faculties_email_key ON public.faculties USING btree (email);


--
-- Name: student_answers_student_test_id_question_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_answers_student_test_id_question_id_key ON public.student_answers USING btree (student_test_id, question_id);


--
-- Name: student_tests_test_id_student_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_tests_test_id_student_id_key ON public.student_tests USING btree (test_id, student_id);


--
-- Name: students_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX students_email_key ON public.students USING btree (email);


--
-- Name: students_enrollment_no_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX students_enrollment_no_key ON public.students USING btree (enrollment_no);


--
-- Name: violations_client_event_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX violations_client_event_id_key ON public.violations USING btree (client_event_id);


--
-- Name: question_bank question_bank_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculties(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: section_questions section_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_questions
    ADD CONSTRAINT section_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: section_questions section_questions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_questions
    ADD CONSTRAINT section_questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.test_sections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_answers student_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_answers
    ADD CONSTRAINT student_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: student_answers student_answers_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_answers
    ADD CONSTRAINT student_answers_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.test_sections(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: student_answers student_answers_student_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_answers
    ADD CONSTRAINT student_answers_student_test_id_fkey FOREIGN KEY (student_test_id) REFERENCES public.student_tests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_tests student_tests_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tests
    ADD CONSTRAINT student_tests_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.faculties(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: student_tests student_tests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tests
    ADD CONSTRAINT student_tests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: student_tests student_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tests
    ADD CONSTRAINT student_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: test_sections test_sections_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_sections
    ADD CONSTRAINT test_sections_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tests tests_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculties(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: violations violations_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: violations violations_student_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_student_test_id_fkey FOREIGN KEY (student_test_id) REFERENCES public.student_tests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: violations violations_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict tGku7UFfH0vE1rdB91aPSw07B06TyOSG7BujHLrevEFg1YcOJ26MSF9jlxNQjVG

