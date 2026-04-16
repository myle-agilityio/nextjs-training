import postgres from 'postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
} from './definitions';
import { formatCurrency } from './utils';
import { customers, invoices, revenue } from './placeholder-data';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function fetchRevenue() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return revenue;
}

export async function fetchLatestInvoices() {
  await new Promise((resolve) => setTimeout(resolve, 4000));
  // Simulate the database query using placeholder data
  // const data = await sql<LatestInvoiceRaw[]>`
  //     SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
  //     FROM invoices
  //     JOIN customers ON invoices.customer_id = customers.id
  //     ORDER BY invoices.date DESC
  //     LIMIT 5`;
  const joinedData = invoices.map(invoice => {
    const customer = customers.find(c => c.id === invoice.customer_id);
    if (!customer) return null;
    return {
      id: invoice.id,
      amount: invoice.amount,
      name: customer.name,
      image_url: customer.image_url,
      email: customer.email,
      date: invoice.date,
    };
  }).filter((invoice): invoice is NonNullable<typeof invoice> => invoice !== null);

  // Sort by date descending
  joinedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Take the first 5
  const latest = joinedData.slice(0, 5);

  // Format the amount
  const latestInvoices = latest.map(invoice => ({
    ...invoice,
    amount: formatCurrency(invoice.amount),
  }));

  return latestInvoices;
}

export async function fetchCardData() {
    // const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    // const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    // const invoiceStatusPromise = sql`SELECT
    // SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
    // SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
    // FROM invoices`;

  const invoiceCountPromise = new Promise<number>((resolve) =>
    setTimeout(() => resolve(invoices.length), 1000),
  );

  const customerCountPromise = new Promise<number>((resolve) =>
    setTimeout(() => resolve(customers.length), 1000),
  );

  const totalPaidPromise = new Promise<number>((resolve) =>
    setTimeout(
      () =>
        resolve(
          invoices
            .filter((invoice) => invoice.status === 'paid')
            .reduce((sum, invoice) => sum + invoice.amount, 0),
        ),
      1000,
    ),
  );

  const [numberOfInvoices, numberOfCustomers, totalPaid] = await Promise.all([
    invoiceCountPromise,
    customerCountPromise,
    totalPaidPromise,
  ]);

  const totalPending = invoices
    .filter((invoice) => invoice.status === 'pending')
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const totalPaidInvoices = formatCurrency(totalPaid);
  const totalPendingInvoices = formatCurrency(totalPending);

  return {
    numberOfCustomers,
    numberOfInvoices,
    totalPaidInvoices,
    totalPendingInvoices,
  };
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    // const invoices = await sql<InvoicesTable[]>`
    //   SELECT
    //     invoices.id,
    //     invoices.amount,
    //     invoices.date,
    //     invoices.status,
    //     customers.name,
    //     customers.email,
    //     customers.image_url
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   WHERE
    //     customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`} OR
    //     invoices.amount::text ILIKE ${`%${query}%`} OR
    //     invoices.date::text ILIKE ${`%${query}%`} OR
    //     invoices.status ILIKE ${`%${query}%`}
    //   ORDER BY invoices.date DESC
    //   LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    // `;

  const searchTerm = query.toLowerCase();

  const filteredInvoices = invoices
    .map((invoice) => {
      const customer = customers.find((c) => c.id === invoice.customer_id);
      if (!customer) return null;
      return {
        id: invoice.id,
        amount: invoice.amount,
        date: invoice.date,
        status: invoice.status,
        name: customer.name,
        email: customer.email,
        image_url: customer.image_url,
      };
    })
    .filter((invoice): invoice is NonNullable<typeof invoice> => invoice !== null)
    .filter(
      (invoice) =>
        invoice.name.toLowerCase().includes(searchTerm) ||
        invoice.email.toLowerCase().includes(searchTerm) ||
        String(invoice.amount).includes(searchTerm) ||
        invoice.date.includes(searchTerm) ||
        invoice.status.includes(searchTerm),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(offset, offset + ITEMS_PER_PAGE);

  return filteredInvoices;
}

export async function fetchInvoicesPages(query: string) {
  const searchTerm = query.toLowerCase();
  
  const filteredInvoices = invoices.filter((invoice) => {
    const customer = customers.find((c) => c.id === invoice.customer_id);
    if (!customer) return false;

    return (
      customer.name.toLowerCase().includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm) ||
      String(invoice.amount).includes(searchTerm) ||
      invoice.date.includes(searchTerm) ||
      invoice.status.includes(searchTerm)
    );
  });

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  return totalPages;
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
