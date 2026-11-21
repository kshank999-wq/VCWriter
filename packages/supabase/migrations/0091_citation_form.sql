-- How a citation reads in the text (addendum 43, from Ken, 21 November: *the
-- block quote is usually author and date, if not a page number. So you can
-- select that format*). 'style' follows the book's citation style; 'author-date'
-- is always (Author, Year, p. n) in the text and takes no footnote.

alter table public.citations add column if not exists form text not null default 'style';
alter table public.citations drop constraint if exists citations_form_check;
alter table public.citations add constraint citations_form_check check (form in ('style', 'author-date'));
